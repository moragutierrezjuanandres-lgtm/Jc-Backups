import { randomUUID } from 'node:crypto';

const iso=value=>value==null?null:new Date(value).toISOString();
const runView=row=>row&&({id:row.id,deviceId:row.device_id,policyRevision:row.policy_revision,occurrenceKey:row.occurrence_key,status:row.status,attemptsStarted:row.attempts_started,retryAt:iso(row.retry_at),snapshotId:row.snapshot_id,leaseUntil:iso(row.lease_until),createdAt:iso(row.created_at)});
const error=(status,message)=>Object.assign(new Error(message),{status});

export class BackupRepository {
  constructor(pool){this.pool=pool;}
  async transaction(callback){
    const client=await this.pool.connect();
    try{await client.query('BEGIN');const result=await callback(client);await client.query('COMMIT');return result;}
    catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}
    finally{client.release();}
  }
  async enqueue(deviceId,occurrenceKey,policyRevision){
    if(typeof occurrenceKey!=='string'||!occurrenceKey||occurrenceKey.length>200)throw error(400,'Ocurrencia no válida.');
    const result=await this.pool.query(`INSERT INTO backup_runs(id,device_id,occurrence_key,policy_revision)
      VALUES($1,$2,$3,$4) ON CONFLICT(device_id,occurrence_key) DO UPDATE SET occurrence_key=EXCLUDED.occurrence_key
      RETURNING *`,[randomUUID(),deviceId,occurrenceKey,policyRevision]);
    return runView(result.rows[0]);
  }
  async claim(deviceId,now=new Date()){
    return this.transaction(async client=>{
      const device=(await client.query('SELECT id,status FROM backup_devices WHERE id=$1 FOR UPDATE',[deviceId])).rows[0];
      if(!device||device.status!=='active')return null;
      const existing=(await client.query(`SELECT id FROM backup_runs WHERE device_id=$1 AND status='running' AND lease_until>$2 LIMIT 1`,[deviceId,now])).rows[0];
      if(existing)return null;
      const candidate=(await client.query(`SELECT * FROM backup_runs WHERE device_id=$1 AND
        (status='queued' OR (status='retry_wait' AND retry_at<=$2))
        ORDER BY created_at,id LIMIT 1 FOR UPDATE`,[deviceId,now])).rows[0];
      if(!candidate)return null;
      const attempt=candidate.attempts_started+1;
      if(attempt>2)throw error(409,'Intentos agotados.');
      const leaseUntil=new Date(new Date(now).getTime()+120000);
      const updated=(await client.query(`UPDATE backup_runs SET status='running',attempts_started=$2,
        lease_until=$3,started_at=COALESCE(started_at,$4),retry_at=NULL WHERE id=$1 RETURNING *`,[candidate.id,attempt,leaseUntil,now])).rows[0];
      return {...runView(updated),attempt};
    });
  }
  async appendEvent(deviceId,event,now=new Date(),{verified=false}={}){
    const {runId,attempt,sequence,kind,payload={}}=event||{};
    if(!runId||![1,2].includes(attempt)||!Number.isInteger(sequence)||sequence<0||!['start','progress','result'].includes(kind)||typeof payload!=='object'||!payload)throw error(400,'Evento no válido.');
    return this.transaction(async client=>{
      const run=(await client.query('SELECT * FROM backup_runs WHERE id=$1 AND device_id=$2 FOR UPDATE',[runId,deviceId])).rows[0];
      if(!run)throw error(404,'Ejecución no disponible.');
      const previous=(await client.query('SELECT id FROM backup_run_events WHERE run_id=$1 AND attempt=$2 AND sequence=$3',[runId,attempt,sequence])).rows[0];
      if(previous)return runView(run);
      if(run.status!=='running'||run.attempts_started!==attempt)throw error(409,'La tentativa no está activa.');
      const safePayload={...payload};
      for(const name of ['password','token','key','secret','repository'])delete safePayload[name];
      await client.query('INSERT INTO backup_run_events(id,run_id,attempt,sequence,kind,payload,received_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[randomUUID(),runId,attempt,sequence,kind,JSON.stringify(safePayload),now]);
      if(kind!=='result')return runView(run);
      const success=payload.exitCode===0&&typeof payload.snapshotId==='string'&&payload.snapshotId.length>0&&verified;
      let status,retryAt=null,snapshotId=null,completedAt=null;
      if(success){status='succeeded';snapshotId=payload.snapshotId;completedAt=now;}
      else if(payload.exitCode===0&&typeof payload.snapshotId==='string'&&payload.snapshotId.length>0){status='verifying';snapshotId=payload.snapshotId;}
      else if(attempt===1){status='retry_wait';retryAt=new Date(new Date(now).getTime()+900000);}
      else {status='failed';completedAt=now;}
      const updated=(await client.query(`UPDATE backup_runs SET status=$2,retry_at=$3,snapshot_id=$4,
         lease_until=NULL,completed_at=$5 WHERE id=$1 RETURNING *`,[runId,status,retryAt,snapshotId,completedAt])).rows[0];
      if(success){
        const processed=Number.isSafeInteger(payload.processedBytes)&&payload.processedBytes>=0?payload.processedBytes:0;
        const added=Number.isSafeInteger(payload.addedBytes)&&payload.addedBytes>=0?payload.addedBytes:0;
        await client.query(`INSERT INTO backup_snapshots(id,device_id,run_id,snapshot_id,verified_at,processed_bytes,added_bytes)
          VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(run_id) DO NOTHING`,[randomUUID(),deviceId,runId,snapshotId,now,processed,added]);
        await client.query(`UPDATE backup_alerts SET resolved_at=$2 WHERE device_id=$1 AND resolved_at IS NULL AND kind IN ('failed','overdue')`,[deviceId,now]);
      }else if(status==='failed'){
        const device=(await client.query('SELECT client_id FROM backup_devices WHERE id=$1',[deviceId])).rows[0];
        await client.query(`INSERT INTO backup_alerts(id,client_id,device_id,run_id,kind,message)
          VALUES($1,$2,$3,$4,'failed','Dos tentativas de respaldo fallaron.') ON CONFLICT(device_id,run_id,kind) DO NOTHING`,[randomUUID(),device.client_id,deviceId,runId]);
      }
      return runView(updated);
    });
  }
}
