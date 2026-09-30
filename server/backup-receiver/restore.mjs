import { createDecipheriv } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { repositoryPath } from './provision.mjs';
const execute=promisify(execFile);
export async function restoreSnapshot({binary,path,password,snapshotId,target,signal}) {
 if(!/^[a-f0-9]{64}$/.test(snapshotId))throw new Error('invalid_snapshot');
 await mkdir(target,{recursive:false});
 await execute(binary,['-r',path,'restore',snapshotId,'--target',target,'--verify'],{windowsHide:true,signal,timeout:12*3600000,maxBuffer:16*1024*1024,env:{...process.env,RESTIC_PASSWORD:password}});
}
export function startRestorer({pool,vaultKey,storageRoot,binary,restoreRoot}) {
 const abort=new AbortController();let running=null;
 async function step(){
  await pool.query(`UPDATE backup_restore_jobs SET status='failed',error_code='interrupted',completed_at=now(),lease_until=NULL WHERE status='running' AND lease_until<=now()`);
  const job=(await pool.query(`UPDATE backup_restore_jobs SET status='running',lease_until=now()+interval '13 hours'
    WHERE id=(SELECT id FROM backup_restore_jobs WHERE status='queued' AND expires_at>now() ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];
  if(!job)return;
  try {
   if(!/^[a-f0-9-]{36}$/.test(job.id))throw new Error('invalid_job');
   const device=(await pool.query('SELECT repository_id,repository_secret FROM backup_devices WHERE id=$1',[job.device_id])).rows[0];
   const verified=(await pool.query('SELECT id FROM backup_snapshots WHERE device_id=$1 AND snapshot_id=$2 AND retained=true',[job.device_id,job.snapshot_id])).rows[0];
   if(!verified)throw new Error('snapshot_unavailable');
   const envelope=JSON.parse(device.repository_secret),decipher=createDecipheriv('aes-256-gcm',vaultKey,Buffer.from(envelope.iv,'base64'));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
   const secret=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString());
   await mkdir(restoreRoot,{recursive:true});const target=join(restoreRoot,job.id);
   await restoreSnapshot({binary,path:repositoryPath(storageRoot,device.repository_id),password:secret.key,snapshotId:job.snapshot_id,target,signal:abort.signal});
   await pool.query(`UPDATE backup_restore_jobs SET status='succeeded',destination_path=$2,completed_at=now(),lease_until=NULL WHERE id=$1`,[job.id,target]);
  }catch(error){await pool.query(`UPDATE backup_restore_jobs SET status='failed',error_code=$2,completed_at=now(),lease_until=NULL WHERE id=$1`,[job.id,abort.signal.aborted?'interrupted':'restore_failed']);}
 }
 const tick=()=>{if(!running&&!abort.signal.aborted)running=step().catch(error=>console.error('Backup restore:',error.code||error.name)).finally(()=>{running=null;});};
 const timer=setInterval(tick,10000);timer.unref();tick();
 return async()=>{clearInterval(timer);abort.abort();await running;};
}
