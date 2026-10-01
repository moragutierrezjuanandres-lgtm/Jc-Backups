import { randomUUID } from 'node:crypto';
import { win32 } from 'node:path';

const iso=value=>value==null?null:new Date(value).toISOString();
const runView=row=>row&&({id:row.id,deviceId:row.device_id,policyRevision:row.policy_revision,occurrenceKey:row.occurrence_key,status:row.status,attemptsStarted:row.attempts_started,retryAt:iso(row.retry_at),snapshotId:row.snapshot_id,leaseUntil:iso(row.lease_until),createdAt:iso(row.created_at),progress:row.progress});
const error=(status,message)=>Object.assign(new Error(message),{status});

export class BackupRepository {
  constructor(pool){this.pool=pool;}
  async cancel(id){
    const r=await this.pool.query(`UPDATE backup_runs SET cancel_requested=true,status=CASE WHEN status='running' THEN 'running' ELSE 'cancelled' END,retry_at=NULL,completed_at=CASE WHEN status='running' THEN completed_at ELSE now() END WHERE id=$1 AND status IN ('queued','retry_wait','running') RETURNING *`,[id]);
    if(!r.rows[0])throw error(409,'Solo se pueden detener tareas pendientes o en ejecución.');
    return {...runView(r.rows[0]),cancelRequested:true};
  }
  async control(deviceId,id){
    const r=(await this.pool.query('SELECT cancel_requested,status FROM backup_runs WHERE device_id=$1 AND (id::text=$2 OR occurrence_key=$2)',[deviceId,id])).rows[0];
    if(!r)throw error(404,'Ejecución no disponible.');
    return {cancelRequested:r.cancel_requested||r.status==='cancelled'};
  }
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
      await client.query(`UPDATE backup_runs SET status=CASE WHEN cancel_requested THEN 'cancelled' WHEN attempts_started<2 THEN 'retry_wait' ELSE 'failed' END,
        retry_at=CASE WHEN NOT cancel_requested AND attempts_started<2 THEN $2::timestamptz+interval '15 minutes' ELSE NULL END,
        completed_at=CASE WHEN cancel_requested OR attempts_started=2 THEN $2 ELSE NULL END,lease_until=NULL
        WHERE device_id=$1 AND status='running' AND lease_until<=$2`,[deviceId,now]);
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
      let run=(await client.query('SELECT * FROM backup_runs WHERE id=$1 AND device_id=$2 FOR UPDATE',[runId,deviceId])).rows[0];
      if(!run)throw error(404,'Ejecución no disponible.');
      if(run.status==='cancelled')return runView(run);
      const previous=(await client.query('SELECT id FROM backup_run_events WHERE run_id=$1 AND attempt=$2 AND sequence=$3',[runId,attempt,sequence])).rows[0];
      if(previous)return runView(run);
      // Offline schedules reach the coordinator after they were executed. Accept
      // only the next start in that device's existing scheduled occurrence.
      if(kind==='start'&&run.occurrence_key.startsWith('scheduled:')&&attempt===run.attempts_started+1&&
        (run.status==='queued'||(run.status==='retry_wait'&&new Date(run.retry_at)<=now))){
        run=(await client.query(`UPDATE backup_runs SET status='running',attempts_started=$2,started_at=COALESCE(started_at,$3),retry_at=NULL,lease_until=$4 WHERE id=$1 RETURNING *`,[runId,attempt,now,new Date(now.getTime()+120000)])).rows[0];
      }
      if(run.status!=='running'||run.attempts_started!==attempt)throw error(409,'La tentativa no está activa.');
      const safePayload={};
      for(const name of ['exitCode','snapshotId','processedBytes','addedBytes','errorCode'])if(typeof payload[name]==='string'||typeof payload[name]==='number')safePayload[name]=typeof payload[name]==='string'?payload[name].slice(0,200):payload[name];
      await client.query('INSERT INTO backup_run_events(id,run_id,attempt,sequence,kind,payload,received_at) VALUES($1,$2,$3,$4,$5,$6::jsonb,$7)',[randomUUID(),runId,attempt,sequence,kind,JSON.stringify(safePayload),now]);
      if(kind!=='result'){
        const refreshed=(await client.query('UPDATE backup_runs SET lease_until=$2 WHERE id=$1 RETURNING *',[runId,new Date(now.getTime()+120000)])).rows[0];
        return runView(refreshed);
      }
      const success=payload.exitCode===0&&typeof payload.snapshotId==='string'&&payload.snapshotId.length>0&&verified;
      let status,retryAt=null,snapshotId=null,completedAt=null;
      if(run.cancel_requested||payload.errorCode==='cancelled'){status='cancelled';completedAt=now;}
      else if(success){status='succeeded';snapshotId=payload.snapshotId;completedAt=now;}
      else if(payload.exitCode===0&&typeof payload.snapshotId==='string'&&payload.snapshotId.length>0){status='verifying';snapshotId=payload.snapshotId;}
      else if(attempt===1){status='retry_wait';retryAt=new Date(new Date(now).getTime()+900000);}
      else {status='failed';completedAt=now;}
      const updated=(await client.query(`UPDATE backup_runs SET status=$2,retry_at=$3,snapshot_id=$4,
         lease_until=NULL,completed_at=$5 WHERE id=$1 RETURNING *`,[runId,status,retryAt,snapshotId,completedAt])).rows[0];
      if(success&&status==='succeeded'){
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
  async telemetry(deviceId,input={},now=new Date()){
    const percent=Number(input.progress);
    if(!input.runId||![1,2].includes(input.attempt)||!Number.isFinite(percent)||percent<0||percent>100)throw error(400,'Datos de progreso no válidos.');
    const count=value=>Number.isSafeInteger(value)&&value>=0?value:0;
    const progress={percent,bytesDone:count(input.processedBytes),totalBytes:count(input.totalBytes),filesDone:count(input.filesDone),totalFiles:count(input.totalFiles),
      currentFile:typeof input.currentFile==='string'?win32.basename(input.currentFile.replace(/[\x00-\x1f]/g,'')).slice(0,255):'',bytesPerSecond:count(Math.round(input.bytesPerSecond||0)),updatedAt:now.toISOString()};
    const result=await this.pool.query(`UPDATE backup_runs SET progress=$4::jsonb,lease_until=$5 WHERE device_id=$1 AND (id::text=$2 OR occurrence_key=$2) AND attempts_started=$3 AND status='running' RETURNING *`,[deviceId,input.runId,input.attempt,JSON.stringify(progress),new Date(now.getTime()+120000)]);
    if(!result.rows[0])throw error(404,'Ejecución no disponible.');
    return runView(result.rows[0]);
  }
  async heartbeat(deviceId,now=new Date()){
    await this.pool.query("UPDATE backup_runs SET lease_until=$2 WHERE device_id=$1 AND status='running'",[deviceId,new Date(now.getTime()+120000)]);
  }
}
