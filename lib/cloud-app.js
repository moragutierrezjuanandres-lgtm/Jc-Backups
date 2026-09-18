import express from 'express';
import { randomBytes, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { passwordMatches, publicEmployee } from './auth.js';
import { allowed, visibleDb } from './access.js';
import { applyRecordChanges } from './records.js';
import { authorizedImport, importCollections } from './cloud-import.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const digest=text=>createHash('sha256').update(text).digest('hex');
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const view=(state,user)=>({user:publicEmployee(user),db:visibleDb(state.read(),user),revision:state.revision()});

export function createCloudApp({store,vaultKey,origins=['https://jcevnzl.space','https://www.jcevnzl.space'],secureCookie=true,importToken=process.env.JC_IMPORT_TOKEN}) {
  if(!Buffer.isBuffer(vaultKey)||vaultKey.length!==32)throw new Error('JC_VAULT_KEY debe contener la clave original de 32 bytes en base64.');
  const app=express();app.disable('x-powered-by');
  app.use((req,res,next)=>{
    res.set({'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY'});
    if(!['GET','HEAD','OPTIONS'].includes(req.method)){
      if(req.headers.origin && !origins.includes(req.headers.origin))return res.status(403).json({error:'Origen no autorizado.'});
      if(!req.is('application/json'))return res.status(415).json({error:'Se requiere application/json.'});
    }
    next();
  });
  app.use(express.json({limit:'4mb'}));
  app.post('/api/setup/import',wrap(async(req,res)=>{
    if(!authorizedImport(req.headers.authorization,importToken))throw fail(404,'Ruta no disponible.');
    res.json(await importCollections(store,req.body.collections,req.body.revision));
  }));
  const cookie=(res,token,maxAge)=>res.cookie('jc_session',token,{httpOnly:true,sameSite:'strict',secure:secureCookie,maxAge,path:'/'});
  app.get('/api/health',wrap(async(req,res)=>{await store.pool.query('SELECT 1');res.json({service:'jc-portal-api',status:'ok'});}));
  app.post('/api/auth/login',wrap(async(req,res)=>{
    const username=String(req.body.username||'').trim().toLowerCase();
    if(!username||username.length>254||typeof req.body.password!=='string'||req.body.password.length>1024)throw fail(400,'Ingresa tu usuario y contraseña.');
    const attemptKey=digest(username);
    if(!await store.attempt(attemptKey))throw fail(429,'Demasiados intentos. Espera 15 minutos.');
    const token=randomBytes(32).toString('hex');
    const result=await store.transaction(true,async(state,client)=>{
      if(!state.get('employees').length)throw fail(503,'Falta importar los usuarios del portal.');
      const user=state.get('employees').find(e=>[e.name,e.email,e.email?.split('@')[0]].some(v=>v?.toLowerCase()===username));
      if(!user||user.status!=='Activo'||!passwordMatches(req.body.password,user.passwordHash))throw fail(401,'Usuario o contraseña incorrectos.');
      await client.query('DELETE FROM jc_sessions WHERE expires<$1',[Date.now()]);
      await client.query('INSERT INTO jc_sessions(token,user_id,expires) VALUES($1,$2,$3)',[digest(token),user.id,Date.now()+28800000]);
      state.audit(user.name,'Inicio de sesión','Autenticación validada en el servidor.');
      return {success:true,...view(state,user)};
    });
    await store.clearAttempt(attemptKey);cookie(res,token,28800000);res.json(result);
  }));
  // Authentication and record changes share the same database transaction.
  const authorized=(write,handler)=>wrap(async(req,res)=>{
    const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('jc_session='))?.slice(11);
    if(!token)throw fail(401,'Inicia sesión para continuar.');
    const result=await store.transaction(write,async(state,client)=>{
      const session=(await client.query('SELECT user_id FROM jc_sessions WHERE token=$1 AND expires>$2',[digest(token),Date.now()])).rows[0];
      const user=session&&state.get('employees').find(e=>e.id===session.user_id&&e.status==='Activo');
      if(!user)throw fail(401,'Inicia sesión para continuar.');
      return handler({req,state,client,user,token});
    });
    if(req.path==='/api/auth/logout')cookie(res,'',0);
    res.json(result);
  });
  app.get('/api/auth/session',authorized(false,({state,user})=>view(state,user)));
  app.post('/api/auth/logout',authorized(true,async({client,token})=>{await client.query('DELETE FROM jc_sessions WHERE token=$1',[digest(token)]);return {success:true};}));
  app.get('/api/db/status',authorized(false,({state})=>({lastModified:state.revision()})));
  app.get('/api/db',authorized(false,({state,user})=>visibleDb(state.read(),user)));
  app.post('/api/db',authorized(false,()=>{throw fail(410,'La sobrescritura de la base completa fue deshabilitada.');}));
  app.patch('/api/db',authorized(true,({state,user,req})=>{applyRecordChanges(state,user,req.body.changes);return {success:true,...view(state,user)};}));
  app.post('/api/vault/:operation',authorized(true,({state,user,req})=>{
    if(!allowed(user,'clients')&&!allowed(user,'layouts'))throw fail(403,'Acceso a credenciales denegado.');
    if(req.params.operation==='encrypt'){
      if(typeof req.body.text!=='string'||req.body.text.length>16384)throw fail(400,'Valor no válido.');
      const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',vaultKey,iv);
      const data=Buffer.concat([cipher.update(req.body.text,'utf8'),cipher.final()]);
      return {value:JSON.stringify({mode:'server-v1',iv:iv.toString('base64'),data:data.toString('base64'),tag:cipher.getAuthTag().toString('base64')})};
    }
    if(req.params.operation!=='decrypt')throw fail(404,'Operación desconocida.');
    let value;
    try{const p=JSON.parse(req.body.value);const cipher=createDecipheriv('aes-256-gcm',vaultKey,Buffer.from(p.iv,'base64'));cipher.setAuthTag(Buffer.from(p.tag,'base64'));value=Buffer.concat([cipher.update(Buffer.from(p.data,'base64')),cipher.final()]).toString('utf8');}
    catch{throw fail(400,'No se pudo descifrar la credencial.');}
    state.audit(user.name,'Consulta de credencial','Credencial descifrada.');return {value};
  }));
  app.use('/api/backups',authorized(false,()=>{throw fail(503,'Los respaldos de equipos se gestionan desde el servidor local. Falta conectar el coordinador con el portal en la nube.');}));
  app.use('/api',(req,res)=>res.status(404).json({error:'Ruta no disponible.'}));
  app.use((error,req,res,next)=>{
    if(res.headersSent)return next(error);
    const status=error.status||503;
    if(!error.status)console.error('Cloud API:',error.code||error.name);
    res.status(status).json({error:error.status?error.message:'No se pudo conectar con los datos. Inténtalo de nuevo.'});
  });
  return app;
}
