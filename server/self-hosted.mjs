import { pathToFileURL } from 'node:url';
import { createCloudApp } from '../lib/cloud-app.js';
import { PostgresStore } from '../lib/postgres.js';

export function readConfig(env=process.env) {
  if(!env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria.');
  const database=new URL(env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(database.protocol)||!['localhost','127.0.0.1','[::1]'].includes(database.hostname)) throw new Error('PostgreSQL debe estar en el servidor local.');
  const vaultKey=Buffer.from(env.JC_VAULT_KEY||'','base64');
  if(vaultKey.length!==32)throw new Error('JC_VAULT_KEY debe conservar la clave original de 32 bytes.');
  const origins=(env.JC_ALLOWED_ORIGINS||'https://jcevnzl.space,https://www.jcevnzl.space').split(',').map(v=>v.trim());
  for(const origin of origins) {
    const url=new URL(origin);
    if(url.protocol!=='https:'||url.origin!==origin)throw new Error('Los orígenes deben ser HTTPS sin rutas.');
  }
  const port=Number(env.PORT??5000);
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT no es válido.');
  return {connectionString:env.DATABASE_URL,vaultKey,origins,port,host:'127.0.0.1'};
}

export async function startServer(config,store=new PostgresStore(config.connectionString)) {
  try {
    await store.pool.query('SELECT 1');
    const app=createCloudApp({store,vaultKey:config.vaultKey,origins:config.origins,secureCookie:true,importToken:''});
    const server=await new Promise((resolve,reject)=>{
      const instance=app.listen(config.port,config.host,()=>resolve(instance));
      instance.once('error',reject);
    });
    let closing;
    return {server,close:()=>closing??=(async()=>{await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await store.close();})()};
  } catch(error) {await store.close();throw error;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  try {
    const running=await startServer(readConfig());
    console.log(`JC API escuchando en 127.0.0.1:${running.server.address().port}`);
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>running.close().then(()=>process.exit(0),()=>process.exit(1)));
  } catch(error) {
    console.error('No se pudo iniciar JC API:',error.code||error.message);
    process.exitCode=1;
  }
}
