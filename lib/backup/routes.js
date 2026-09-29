import { canManageBackups, canReadClient } from './auth.js';
import { randomUUID } from 'node:crypto';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const publicDevice=r=>({id:r.id,clientId:r.client_id,label:r.label,status:r.status,lastSeenAt:r.last_seen_at,repositoryId:r.repository_id,policyRevision:r.policy_revision,createdAt:r.created_at});

export function installBackupRoutes(app,{pool,auth,repository,authorize,receiverConfigured=true}){
  if(!pool||!auth||!repository||!authorize) return;
  const operator=handler=>authorize(false,async({user,req})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso para gestionar respaldos.');return handler({user,req});});
  app.get('/api/backups',authorize(false,async({user})=>{
    if(!canManageBackups(user)&&user.role!=='Cliente')throw fail(403,'No tienes permiso para consultar respaldos.');
    const args=canManageBackups(user)?[]:[user.clientId];
    const where=args.length?'WHERE client_id=$1':'';
    const devices=(await pool.query(`SELECT * FROM backup_devices ${where} ORDER BY created_at DESC`,args)).rows;
    return {devices:devices.filter(d=>canManageBackups(user)||canReadClient(user,d.client_id)).map(publicDevice),runs:[],alerts:[]};
  }));
  app.post('/api/backups/enrollments',authorize(true,async({user,req})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');return auth.createEnrollment(String(req.body.clientId||''),user.id);}));
  app.get('/api/backups/devices',authorize(false,async({user})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');return {devices:(await pool.query('SELECT * FROM backup_devices ORDER BY created_at DESC')).rows.map(publicDevice)};}));
  app.delete('/api/backups/devices/:id',authorize(true,async({user,req})=>{if(!canManageBackups(user))throw fail(403,'No tienes permiso.');return auth.revoke(req.params.id);}));
  app.post('/api/backups/policies',authorize(true,async({user,req})=>{
    if(!canManageBackups(user))throw fail(403,'No tienes permiso.');
    const b=req.body||{},compression=b.compression===undefined?'auto':b.compression;
    if(!['auto','max'].includes(compression)||!Array.isArray(b.sourceDirs)||!b.sourceDirs.length)throw fail(400,'Política no válida.');
    const current=(await pool.query('SELECT COALESCE(MAX(revision),0) revision FROM backup_policies WHERE device_id=$1',[b.deviceId])).rows[0].revision;
    const revision=Number(current)+1;
    await pool.query(`INSERT INTO backup_policies(id,device_id,revision,source_dirs,excludes,days,time,timezone,retention_successful_count,consistency_profile,compression,enabled)
      VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12)`,[randomUUID(),b.deviceId,revision,JSON.stringify(b.sourceDirs),JSON.stringify(b.excludes||[]),JSON.stringify(b.days||[]),b.time,b.timezone||'America/Caracas',Math.max(1,Math.min(365,Number(b.retentionSuccessfulCount||7))),b.consistencyProfile||'files',compression,Boolean(b.enabled)]);
    await pool.query('UPDATE backup_devices SET policy_revision=$2 WHERE id=$1',[b.deviceId,revision]);
    return {revision,compression};
  }));
  app.post('/api/backup-agent/enroll',wrap(async(req,res)=>{if(!receiverConfigured)throw fail(503,'Receptor de respaldos no configurado.');res.json(await auth.enroll(String(req.body.code||''),String(req.body.label||'Equipo')));}));
  app.use('/api/backup-agent',wrap(async(req,res,next)=>{if(req.path==='/enroll')return next();try{req.backupDevice=await auth.authenticate(req.headers.authorization);next();}catch(e){next(e);}}));
  app.post('/api/backup-agent/heartbeat',wrap(async(req,res)=>res.json({deviceId:req.backupDevice.id,serverTime:new Date().toISOString(),status:'ok'})));
  app.get('/api/backup-agent/policy',wrap(async(req,res)=>{const r=await pool.query('SELECT * FROM backup_policies WHERE device_id=$1 ORDER BY revision DESC LIMIT 1',[req.backupDevice.id]);res.json(r.rows[0]||null);}));
  app.post('/api/backup-agent/claim',wrap(async(req,res)=>res.json(await repository.claim(req.backupDevice.id,new Date()))));
  app.post('/api/backup-agent/events',wrap(async(req,res)=>res.json(await repository.appendEvent(req.backupDevice.id,req.body,new Date(),{verified:true}))));
  app.post('/api/backup-agent/occurrences',wrap(async(req,res)=>res.json(await repository.enqueue(req.backupDevice.id,String(req.body.occurrenceKey||''),Number(req.body.policyRevision||req.backupDevice.policy_revision||0)))));
}
