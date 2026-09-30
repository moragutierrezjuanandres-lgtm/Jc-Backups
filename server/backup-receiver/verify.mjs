import { createDecipheriv, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { repositoryPath } from './provision.mjs';
const execute = promisify(execFile);

export async function verifySnapshot({binary,path,password,snapshotId,signal}) {
  if(!/^[a-f0-9]{8,64}$/.test(snapshotId)) throw new Error('invalid_snapshot');
  const options={windowsHide:true,signal,timeout:12*3600000,maxBuffer:16*1024*1024,env:{...process.env,RESTIC_PASSWORD:password}};
  const {stdout}=await execute(binary,['-r',path,'snapshots','--json',snapshotId],options);
  const snapshots=JSON.parse(stdout);
  if(snapshots.length!==1||!snapshots[0].id.startsWith(snapshotId)) throw new Error('snapshot_missing');
  await execute(binary,['-r',path,'check','--read-data'],options);
  return snapshots[0].id;
}

export function startVerifier({pool,vaultKey,storageRoot,binary}) {
  const abort=new AbortController(); let running=null;
  async function step() {
    const row=(await pool.query(`UPDATE backup_runs SET verification_lease_until=now()+interval '13 hours',verification_attempts=verification_attempts+1
      WHERE id=(SELECT id FROM backup_runs WHERE status='verifying' AND (verification_retry_at IS NULL OR verification_retry_at<=now())
      AND (verification_lease_until IS NULL OR verification_lease_until<=now()) ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`)).rows[0];
    if(!row) return;
    try {
      const device=(await pool.query('SELECT repository_id,repository_secret FROM backup_devices WHERE id=$1',[row.device_id])).rows[0];
      const envelope=JSON.parse(device.repository_secret);
      const decipher=createDecipheriv('aes-256-gcm',vaultKey,Buffer.from(envelope.iv,'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));
      const secret=JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]).toString());
      const fullId=await verifySnapshot({binary,path:repositoryPath(storageRoot,device.repository_id),password:secret.key,snapshotId:row.snapshot_id,signal:abort.signal});
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`INSERT INTO backup_snapshots(id,device_id,run_id,snapshot_id,verified_at) VALUES($1,$2,$3,$4,now()) ON CONFLICT(run_id) DO NOTHING`,[randomUUID(),row.device_id,row.id,fullId]);
        await client.query(`UPDATE backup_runs SET status='succeeded',snapshot_id=$2,completed_at=now(),verification_lease_until=NULL WHERE id=$1 AND status='verifying'`,[row.id,fullId]);
        await client.query(`UPDATE backup_alerts SET resolved_at=now() WHERE device_id=$1 AND resolved_at IS NULL AND kind IN ('failed','overdue','verification')`,[row.device_id]);
        await client.query('COMMIT');
      } catch(error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
    } catch(error) {
      if(abort.signal.aborted) { await pool.query('UPDATE backup_runs SET verification_lease_until=NULL WHERE id=$1',[row.id]); return; }
      await pool.query(`UPDATE backup_runs SET status=CASE WHEN verification_attempts>=3 THEN 'failed' ELSE 'verifying' END,
        verification_retry_at=now()+interval '15 minutes',verification_lease_until=NULL WHERE id=$1`,[row.id]);
      await pool.query(`INSERT INTO backup_alerts(id,client_id,device_id,run_id,kind,message)
        SELECT $1,client_id,id,$2,'verification','No se pudo verificar la integridad de la copia.' FROM backup_devices WHERE id=$3
        ON CONFLICT(device_id,run_id,kind) DO NOTHING`,[randomUUID(),row.id,row.device_id]);
    }
  }
  const tick=()=>{if(!running&&!abort.signal.aborted)running=step().catch(error=>console.error('Backup verifier:',error.code||error.name)).finally(()=>{running=null;});};
  const timer=setInterval(tick,10000);timer.unref();tick();
  return async()=>{clearInterval(timer);abort.abort();await running;};
}
