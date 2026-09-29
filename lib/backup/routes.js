import { canManageBackups, canReadClient } from './auth.js';
import { savePolicy } from './policy.js';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const publicDevice=r=>({id:r.id,clientId:r.client_id,label:r.label,status:r.status,lastSeenAt:r.last_seen_at,repositoryId:r.repository_id,policyRevision:r.policy_revision,createdAt:r.created_at});
const policyView=r=>r?({id:r.id,deviceId:r.device_id,revision:r.revision,sourceDirs:r.source_dirs,excludes:r.excludes,days:r.days,time:r.time,timezone:r.timezone,retentionSuccessfulCount:r.retention_successful_count,consistencyProfile:r.consistency_profile,compression:r.compression,enabled:r.enabled}):null;

export function installBackupRoutes(app,{pool,auth,repository,authorize,store,receiverConfigured=true}){
  if(!pool||!auth||!repository||!authorize) return;
  const operator=handler=>authorize(false,async({user,req})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso para gestionar respaldos.');return handler({user,req});});
  app.get('/api/backups',authorize(false,async({user})=>{
    if(!canManageBackups(user)&&user.role!=='Cliente')throw fail(403,'No tienes permiso para consultar respaldos.');
    const args=canManageBackups(user)?[]:[user.clientId];
    const where=args.length?'WHERE client_id=$1':'';
    const devices=(await pool.query(`SELECT * FROM backup_devices ${where} ORDER BY created_at DESC`,args)).rows;
    const ids=devices.map(d=>d.id); const filter=ids.length?`WHERE device_id=ANY($1::uuid[])`:'WHERE false';
    const params=ids.length?[ids]:[];
    const [runs,alerts,snapshots]=await Promise.all([pool.query(`SELECT * FROM backup_runs ${filter} ORDER BY created_at DESC LIMIT 100`,params),pool.query(`SELECT * FROM backup_alerts ${filter} AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 100`,params),pool.query(`SELECT * FROM backup_snapshots ${filter} ORDER BY verified_at DESC LIMIT 100`,params)]);
    return {devices:devices.filter(d=>canManageBackups(user)||canReadClient(user,d.client_id)).map(publicDevice),runs:runs.rows,alerts:alerts.rows,snapshots:snapshots.rows};
  }));
  app.post('/api/backups/enrollments',authorize(true,async({user,req,clients})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');if(!clients.some(c=>c.id===req.body.clientId))throw fail(404,'Cliente no disponible.');return auth.createEnrollment(req.body.clientId,user.id);}));
  app.get('/api/backups/devices',authorize(false,async({user})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');return {devices:(await pool.query('SELECT * FROM backup_devices ORDER BY created_at DESC')).rows.map(publicDevice)};}));
  app.delete('/api/backups/devices/:id',authorize(true,async({user,req})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');return auth.revoke(req.params.id);}));
  app.post('/api/backups/policies',authorize(true,async({user,req})=>{
    if(!canManageBackups(user))throw fail(403,'No tienes permiso.');
    return {policy:await savePolicy(repository,req.body.deviceId,req.body)};
  }));
  app.post('/api/backup-agent/setup-policy',authorize(false,async({user,req})=>{
    const device=await auth.authenticate(req.headers.authorization);
    if(!canManageBackups(user)&&!canReadClient(user,device.client_id))throw fail(403,'No tienes acceso a este equipo.');
    return {policy:await savePolicy(repository,device.id,req.body)};
  }));
  app.post('/api/backup-agent/enroll',authorize(false,async({req,user})=>{
    if(!receiverConfigured)throw fail(503,'Receptor de respaldos no configurado.');
    if(!await store.attempt('backup-enroll:'+user.id))throw fail(429,'Demasiados intentos. Espera 15 minutos.');
    const label=req.body.deviceLabel||req.body.label;
    if(typeof label!=='string'||!label.trim()||label.length>100)throw fail(400,'Nombre de equipo no válido.');
    return auth.enroll(req.body.code,label.trim(),new Date(),user);
  }));
  app.use('/api/backup-agent',wrap(async(req,res,next)=>{if(req.path==='/enroll')return next();try{req.backupDevice=await auth.authenticate(req.headers.authorization);next();}catch(e){next(e);}}));
  app.post('/api/backup-agent/heartbeat',wrap(async(req,res)=>res.json({deviceId:req.backupDevice.id,serverTime:new Date().toISOString(),status:'ok'})));
  app.get('/api/backup-agent/policy',wrap(async(req,res)=>{const r=await pool.query('SELECT * FROM backup_policies WHERE device_id=$1 ORDER BY revision DESC LIMIT 1',[req.backupDevice.id]);res.json({policy:policyView(r.rows[0])});}));
  app.get('/api/backup-agent/status',authorize(false,async({req,user})=>{
    req.backupDevice=await auth.authenticate(req.headers.authorization);
    if(!canManageBackups(user)&&!canReadClient(user,req.backupDevice.client_id))throw fail(403,'No tienes acceso a este equipo.');
    const id=req.backupDevice.id;
    const [runs,alerts,snapshots,policy]=await Promise.all([
      pool.query('SELECT id,status,attempts_started,created_at,completed_at FROM backup_runs WHERE device_id=$1 ORDER BY created_at DESC LIMIT 20',[id]),
      pool.query('SELECT id,message,created_at FROM backup_alerts WHERE device_id=$1 AND resolved_at IS NULL ORDER BY created_at DESC LIMIT 20',[id]),
      pool.query('SELECT snapshot_id,verified_at,processed_bytes,added_bytes FROM backup_snapshots WHERE device_id=$1 AND retained=true ORDER BY verified_at DESC LIMIT 20',[id]),
      pool.query('SELECT * FROM backup_policies WHERE device_id=$1 ORDER BY revision DESC LIMIT 1',[id])]);
    return {device:publicDevice(req.backupDevice),runs:runs.rows,alerts:alerts.rows,snapshots:snapshots.rows,policy:policyView(policy.rows[0])};
  }));
  app.post('/api/backup-agent/claim',wrap(async(req,res)=>res.json({run:await repository.claim(req.backupDevice.id,new Date())})));
  app.post('/api/backup-agent/events',wrap(async(req,res)=>{
    res.json(await repository.appendEvent(req.backupDevice.id,req.body,new Date()));
  }));
  app.post('/api/backup-agent/occurrences',wrap(async(req,res)=>res.json({run:await repository.enqueue(req.backupDevice.id,String(req.body.occurrenceKey||''),Number(req.body.policyRevision||req.backupDevice.policy_revision||0))})));
}
