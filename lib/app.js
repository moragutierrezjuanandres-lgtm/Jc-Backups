import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } from 'node:crypto';
import { Store, passwordHash, passwordMatches, publicEmployee } from './store.js';
import { admin, allowed, visibleDb, canWrite } from './access.js';
import { installBackups } from './backups.js';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const error = (status, message) => Object.assign(new Error(message), { status });
const digest = token => createHash('sha256').update(token).digest('hex');
const equal = (a,b) => isDeepStrictEqual(a,b);
export function createApp({ directory = process.env.JC_DATA_DIR || path.join(root,'data'), legacyFile = path.join(root,'database.json'), worker = true } = {}) {
  const app = express();
  const store = new Store(directory, legacyFile);
  app.disable('x-powered-by');
  app.use((req,res,next) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('X-Frame-Options','DENY');
    res.setHeader('Referrer-Policy','same-origin');
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
      if (req.headers.origin) {
        const configured = (process.env.JC_ALLOWED_ORIGINS || '').split(',').filter(Boolean);
        if (req.headers.origin !== `${req.protocol}://${req.get('host')}` && !configured.includes(req.headers.origin)) return res.status(403).json({error:'Origen no autorizado.'});
      }
      if (!req.is('application/json')) return res.status(415).json({error:'Se requiere application/json.'});
    }
    next();
  });
  app.use(express.json({limit:'50mb'}));
  const attempts = new Map();
  const cookie = (res,token,maxAge) => res.cookie('jc_session',token,{httpOnly:true,sameSite:'strict',secure:process.env.JC_SECURE_COOKIE==='1',maxAge,path:'/'});
  app.post('/api/auth/login',(req,res) => {
    const now=Date.now();
    const entry=attempts.get(req.ip);
    const count=entry && entry.until>now ? entry : {count:0,until:now+15*60*1000};
    if(count.count>=10) throw error(429,'Demasiados intentos. Espera 15 minutos.');
    count.count++;attempts.set(req.ip,count);
    if(attempts.size>1000) for(const [key,value] of attempts) if(value.until<now) attempts.delete(key);
    const username=String(req.body.username || '').trim().toLowerCase();
    const user=store.get('employees').find(e=>[e.name,e.email,e.email?.split('@')[0]].some(v=>v?.toLowerCase()===username));
    if(!user || user.status!=='Activo' || typeof req.body.password!=='string' || !passwordMatches(req.body.password,user.passwordHash)) throw error(401,'Usuario o contraseña incorrectos.');
    attempts.delete(req.ip);
    const token=randomBytes(32).toString('hex');
    store.sql.prepare('DELETE FROM sessions WHERE expires<?').run(now);
    store.sql.prepare('INSERT INTO sessions VALUES (?,?,?)').run(digest(token),user.id,now+8*60*60*1000);
    cookie(res,token,8*60*60*1000);
    store.audit(user.name,'Inicio de sesión','Autenticación validada en el servidor.');
    res.json({success:true,user:publicEmployee(user),db:visibleDb(store.read(),user),revision:store.revision()});
  });
  app.use('/api',(req,res,next)=>{
    const token=(req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('jc_session='))?.slice(11);
    const session=token && store.sql.prepare('SELECT * FROM sessions WHERE token=? AND expires>?').get(digest(token),Date.now());
    const user=session && store.get('employees').find(e=>e.id===session.user_id && e.status==='Activo');
    if(!user) return res.status(401).json({error:'Inicia sesión para continuar.'});
    req.user=user;req.sessionToken=digest(token);next();
  });
  app.get('/api/auth/session',(req,res)=>res.json({user:publicEmployee(req.user),db:visibleDb(store.read(),req.user),revision:store.revision()}));
  app.post('/api/auth/logout',(req,res)=>{store.sql.prepare('DELETE FROM sessions WHERE token=?').run(req.sessionToken);cookie(res,'',0);res.json({success:true});});
  app.get('/api/db/status',(req,res)=>res.json({lastModified:store.revision()}));
  app.get('/api/db',(req,res)=>{res.setHeader('X-Last-Modified',String(store.revision()));res.json(visibleDb(store.read(),req.user));});
  app.post('/api/db',(req,res)=>res.status(410).json({error:'Actualiza el portal. La sobrescritura de la base completa fue deshabilitada.'}));
  app.patch('/api/db',(req,res)=>{
    const changes=req.body.changes;
    if(!Array.isArray(changes) || changes.length>1000) throw error(400,'Lista de cambios no válida.');
    store.transaction(()=>{
      for(const change of changes) {
        const {collection,id,before,after}=change;
        if(['auditLogs','backups'].includes(collection)) continue;
        if(!canWrite(req.user,collection)) throw error(403,`No tienes permiso para modificar ${collection}.`);
        const current=store.get(collection);
        if(!Array.isArray(current)) throw error(400,'Colección no válida.');
        if(id == null) {
          if(['employees','clients','projects','tickets','notifications'].includes(collection)) throw error(400,'Esta colección requiere cambios por registro.');
          if(!Array.isArray(after) || !equal(current,before)) throw error(409,'El registro cambió en otro equipo. Actualiza y vuelve a intentarlo.');
          store.put(collection,after);continue;
        }
        const index=current.findIndex(r=>r.id===id);
        const record=index<0?null:current[index];
        const safe=collection==='employees'?publicEmployee(record):record;
        if(req.user.role==='Cliente') {
          if(collection!=='tickets' || record || !after || after.clientId!==req.user.clientId) throw error(403,'Solo puedes crear tickets para tu cliente.');
          const safeFields=['id','title','description','clientId','clientName','photoUrl','imageUrl','createdAt','status','priority','category','history','station'];
          if(Object.keys(after).some(k=>!safeFields.includes(k))) throw error(403,'Campos de ticket no autorizados.');
          after.status='Abierto';after.assigneeId=null;
        }
        let merged;
        if(before===null) {
          if(record) throw error(409,'El registro ya existe.');
          merged=after;
        } else if(after===null) {
          if(!equal(safe,before)) throw error(409,'El registro cambió; no se eliminó.');
          if(collection==='employees' && id===req.user.id) throw error(400,'No puedes eliminar tu propia cuenta.');
          current.splice(index,1);store.put(collection,current);continue;
        } else {
          if(!record || !before || !after) throw error(409,'El registro ya no existe.');
          merged={...record};
          for(const field of new Set([...Object.keys(before),...Object.keys(after)])) {
            if(['__proto__','constructor','prototype','passwordHash'].includes(field)) throw error(400,'Campo no permitido.');
            if(equal(before[field],after[field])) continue;
            if(!equal(safe[field],before[field])) throw error(409,`Otro usuario modificó ${collection}.${field}. Actualiza e inténtalo de nuevo.`);
            if(Object.hasOwn(after,field)) merged[field]=after[field];else delete merged[field];
          }
        }
        if(!merged || typeof merged!=='object' || Array.isArray(merged) || merged.id!==id) throw error(400,'Registro inválido.');
        if(collection==='employees') {
          if(before===null && Object.hasOwn(merged,'passwordHash')) throw error(400,'No se aceptan hashes de contraseña.');
          if(merged.password) {if(typeof merged.password!=='string'||merged.password.length<10) throw error(400,'La nueva contraseña debe tener al menos 10 caracteres.');merged.passwordHash=passwordHash(merged.password);}
          if(!merged.passwordHash) throw error(400,'La cuenta requiere una contraseña.');
          delete merged.password;
          if(!['Administrador','Gerente','Supervisor','Técnico','Asistente','Cliente'].includes(merged.role)) throw error(400,'Rol no válido.');
        }
        if(index<0) current.push(merged);else current[index]=merged;
        store.put(collection,current);
      }
      if(!store.get('employees').some(e=>e.role==='Administrador'&&e.status==='Activo')) throw error(400,'Debe existir al menos un administrador activo.');
      store.audit(req.user.name,'Actualización',`${changes.filter(c=>!['auditLogs','backups'].includes(c.collection)).length} cambios guardados.`);
    });
    res.json({success:true,revision:store.revision(),db:visibleDb(store.read(),req.user)});
  });
  const keyFile=path.join(directory,'vault.key');
  if(!fs.existsSync(keyFile)) fs.writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});
  const vaultKey=fs.readFileSync(keyFile);
  app.post('/api/vault/:operation',(req,res)=>{
    if(!allowed(req.user,'clients') && !allowed(req.user,'layouts')) throw error(403,'Acceso a credenciales denegado.');
    if(req.params.operation==='encrypt') {
      if(typeof req.body.text!=='string' || req.body.text.length>16384) throw error(400,'Valor no válido.');
      const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',vaultKey,iv);
      const encrypted=Buffer.concat([cipher.update(req.body.text,'utf8'),cipher.final()]);
      res.json({value:JSON.stringify({mode:'server-v1',iv:iv.toString('base64'),data:encrypted.toString('base64'),tag:cipher.getAuthTag().toString('base64')})});
    } else if(req.params.operation==='decrypt') {
      try {const p=JSON.parse(req.body.value);const cipher=createDecipheriv('aes-256-gcm',vaultKey,Buffer.from(p.iv,'base64'));cipher.setAuthTag(Buffer.from(p.tag,'base64'));const value=Buffer.concat([cipher.update(Buffer.from(p.data,'base64')),cipher.final()]).toString('utf8');store.audit(req.user.name,'Consulta de credencial','Credencial descifrada.');res.json({value});} catch {throw error(400,'No se pudo descifrar la credencial.');}
    } else throw error(404,'Operación desconocida.');
  });
  const stopWorker=installBackups(app,store,path.resolve(root,'..','Jc-Backups'));
  if(!worker) stopWorker();
  app.post('/api/webhook/whatsapp',(req,res)=>{if(!allowed(req.user,'tickets')) throw error(403,'Sin permiso.');res.json({success:true,ticketId:createTicket(store,req.body).id});});
  app.use('/api',(req,res)=>res.status(404).json({error:'Ruta no disponible en esta versión.'}));
  app.use(express.static(path.join(root,'dist'),{setHeaders:res=>res.setHeader('Cache-Control','no-cache')}));
  app.get('*',(req,res)=>res.sendFile(path.join(root,'dist','index.html')));
  app.use((err,req,res,next)=>{if(res.headersSent)return next(err);res.status(err.status || 500).json({error:err.status?err.message:'No se pudo completar la operación. Revise el registro del servidor.'});if(!err.status)console.error(err);});
  return {app,store,close:()=>{stopWorker();store.close();}};
}
export function createTicket(store,{from,senderName,messageText,photoUrl,imageUrl}) {
  if(typeof from!=='string' || typeof messageText!=='string' || !messageText.trim().startsWith('001')) throw error(400,'El mensaje debe comenzar con 001 e incluir el remitente.');
  const phone=from.split('@')[0].replace(/\D/g,'');
  const client=store.get('clients').find(c=>c.phone?.replace(/\D/g,'')===phone);
  const date=new Date().toISOString();
  const ticket={id:`TIC-${randomUUID().slice(0,8)}`,title:`Reporte WhatsApp - ${client?.commercialName || senderName || phone}`,description:messageText.trim().replace(/^001\s*/,''),clientId:client?.id || 'cli-generic',clientName:client?.commercialName || senderName || phone,originPhone:`+${phone}`,senderPhone:`+${phone}`,status:'Abierto',priority:'Alta',category:'Soporte de Software',assigneeId:null,createdAt:date,photoUrl:photoUrl||imageUrl||null,history:[{date,user:'WhatsApp',action:'Ticket creado',notes:'Mensaje recibido por el bot.'}]};
  store.transaction(()=>{store.put('tickets',[ticket,...store.get('tickets')]);store.audit('WhatsApp','Ticket creado',ticket.id);});return ticket;
}
export async function start() {
  const runtime=createApp();
  const server=runtime.app.listen(Number(process.env.PORT || 5000),process.env.JC_HOST || '0.0.0.0',()=>console.log(`JC Enterprise: http://localhost:${process.env.PORT || 5000}`));
  if(process.env.JC_WHATSAPP==='1') {
    try {
      const {default:pkg}=await import('whatsapp-web.js');
      const {default:qr}=await import('qrcode-terminal');
      const client=new pkg.Client({authStrategy:new pkg.LocalAuth({dataPath:path.join(process.env.JC_DATA_DIR || path.join(root,'data'),'whatsapp')}),puppeteer:{headless:true,...(process.env.JC_BROWSER_PATH?{executablePath:process.env.JC_BROWSER_PATH}:{})}});
      client.on('qr',code=>qr.generate(code,{small:true}));
      client.on('message',async msg=>{if(msg.from.endsWith('@g.us')||!(msg.body || '').trim().startsWith('001'))return;try{const media=msg.hasMedia?await msg.downloadMedia():null;createTicket(runtime.store,{from:msg.from,messageText:msg.body,photoUrl:media?`data:${media.mimetype};base64,${media.data}`:null});}catch(e){console.error('WhatsApp:',e.message);}});
      await client.initialize();
    }catch(e){console.error('WhatsApp no disponible:',e.message);}
  }
  return {server,...runtime};
}
