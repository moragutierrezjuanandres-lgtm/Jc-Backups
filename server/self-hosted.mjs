import { pathToFileURL } from 'node:url';
import { createCloudApp } from '../lib/cloud-app.js';
import { PostgresStore } from '../lib/postgres.js';
import { BackupRepository } from '../lib/backup/repository.js';
import { BackupAuth } from '../lib/backup/auth.js';
import { provisionRepository, revokeRepository } from './backup-receiver/provision.mjs';
import { createReceiverProxy } from './receiver-proxy.mjs';
import { initializeBackupSchema } from '../lib/backup/schema.js';
import { startVerifier } from './backup-receiver/verify.mjs';
import { startRestorer } from './backup-receiver/restore.mjs';
import { resolve } from 'node:path';
import { createDirectoryManager,recoverDirectoryChanges } from './backup-receiver/directory.mjs';

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
  let server;
  try {
    await store.pool.query('SELECT 1');
    await initializeBackupSchema(store.pool);
    let backupAuth=null,backupRepository=null,backupReceiverConfigured=false;
    if(process.env.JC_BACKUP_STORAGE_ROOT&&process.env.JC_BACKUP_RESTIC&&process.env.JC_BACKUP_RECEIVER_URL){
      const receiver={
        provision:({clientId,deviceId})=>provisionRepository({clientId,deviceId,storageRoot:process.env.JC_BACKUP_STORAGE_ROOT,resticBinary:process.env.JC_BACKUP_RESTIC,restServerBaseUrl:process.env.JC_BACKUP_RECEIVER_URL,vaultKey:config.vaultKey}),
        revoke:({clientId,deviceId,repositoryId})=>revokeRepository({clientId,deviceId,repositoryId,storageRoot:process.env.JC_BACKUP_STORAGE_ROOT})
      };
      backupAuth=new BackupAuth(store.pool,config.vaultKey,receiver); backupRepository=new BackupRepository(store.pool); backupReceiverConfigured=true;
    }
    // Keep portal enrollment and device management available even when the
    // local Restic receiver is offline; backup execution reports a clear
    // configuration error instead of hiding the entire module.
    if(!backupAuth){
      const unavailableReceiver={
        provision:()=>{ throw Object.assign(new Error('Receptor de respaldos no configurado.'),{status:503}); },
        revoke:async()=>{}
      };
      backupAuth=new BackupAuth(store.pool,config.vaultKey,unavailableReceiver);
      backupRepository=new BackupRepository(store.pool);
    }
    const receiving=new Map(),activeRepositories=new Set(),storageRoot=process.env.JC_BACKUP_STORAGE_ROOT;
    if(backupReceiverConfigured)await recoverDirectoryChanges({pool:store.pool,storageRoot});
    const backupDirectory=backupReceiverConfigured?createDirectoryManager({pool:store.pool,storageRoot,protectedRoots:[resolve('.'),resolve(storageRoot,'../pgdata')],isReceiving:id=>receiving.has(id)||activeRepositories.has(id)}):null;
    const receiverProxy=createReceiverProxy({port:Number(process.env.JC_BACKUP_RECEIVER_PORT||8000),receiving,canReceive:backupReceiverConfigured?async id=>{const device=(await store.pool.query('SELECT storage_moving FROM backup_devices WHERE repository_id=$1',[id])).rows[0];return !device?.storage_moving;}:null});
    const app=createCloudApp({store,vaultKey:config.vaultKey,origins:config.origins,secureCookie:true,importToken:'',backupAuth,backupRepository,backupReceiverConfigured,receiverProxy,backupDirectory});
    server=await new Promise((resolve,reject)=>{
      const instance=app.listen(config.port,config.host,()=>resolve(instance));
      instance.once('error',reject);
    });
    let closing;
    if(backupReceiverConfigured){
      await store.pool.query("UPDATE backup_runs SET verification_lease_until=NULL WHERE status='verifying'");
      await store.pool.query("UPDATE backup_restore_jobs SET status='failed',error_code='interrupted',lease_until=NULL,completed_at=now() WHERE status='running'");
    }
    const stopVerifier=backupReceiverConfigured?startVerifier({activeRepositories,pool:store.pool,vaultKey:config.vaultKey,storageRoot:process.env.JC_BACKUP_STORAGE_ROOT,binary:process.env.JC_BACKUP_RESTIC}):async()=>{};
    const stopRestorer=backupReceiverConfigured?startRestorer({pool:store.pool,vaultKey:config.vaultKey,storageRoot:process.env.JC_BACKUP_STORAGE_ROOT,binary:process.env.JC_BACKUP_RESTIC,restoreRoot:resolve(process.env.JC_BACKUP_STORAGE_ROOT,'../backup-restores')}):async()=>{};
    return {server,close:()=>closing??=(async()=>{await Promise.all([stopVerifier(),stopRestorer()]);await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));await store.close();})()};
  } catch(error) {if(server?.listening)await new Promise(done=>server.close(done));await store.close();throw error;}
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
