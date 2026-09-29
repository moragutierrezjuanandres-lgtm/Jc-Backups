import { randomUUID } from 'node:crypto';
import { win32 } from 'node:path';
const fail=message=>Object.assign(new Error(message),{status:400});
export function validatePolicy(b={}){
 if(!Array.isArray(b.sourceDirs)||!b.sourceDirs.length||b.sourceDirs.length>100||b.sourceDirs.some(p=>typeof p!=='string'||p.length>32767||!win32.isAbsolute(p)||/[\x00-\x1f]/.test(p)))throw fail('Indica carpetas absolutas de Windows.');
 if(!Array.isArray(b.days)||!b.days.length||b.days.some(d=>!Number.isInteger(d)||d<0||d>6))throw fail('Selecciona días válidos.');
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time||''))throw fail('Hora no válida.');
 const timezone=b.timezone||'America/Caracas';try{new Intl.DateTimeFormat('es',{timeZone:timezone});}catch{throw fail('Zona horaria no válida.');}
 const compression=b.compression??'auto';if(!['auto','max'].includes(compression))throw fail('Compresión no válida.');
 const retention=b.retentionSuccessfulCount??7;if(!Number.isInteger(retention)||retention<1||retention>365)throw fail('Retención no válida.');
 const excludes=b.excludes||[];if(!Array.isArray(excludes)||excludes.length>100||excludes.some(e=>typeof e!=='string'||e.length>1024))throw fail('Exclusiones no válidas.');
 const profile=b.consistencyProfile||'files';if(!['files','files-vss'].includes(profile))throw fail('Este perfil de base de datos aún no está verificado.');
 return {sourceDirs:b.sourceDirs,excludes,days:[...new Set(b.days)],time:b.time,timezone,compression,retentionSuccessfulCount:retention,consistencyProfile:profile,enabled:b.enabled===true};
}
export async function savePolicy(repository,deviceId,input){
 const p=validatePolicy(input);
 return repository.transaction(async c=>{
  const d=(await c.query('SELECT * FROM backup_devices WHERE id=$1 FOR UPDATE',[deviceId])).rows[0];
  if(!d||d.status!=='active')throw Object.assign(new Error('Equipo no disponible.'),{status:404});
  const revision=d.policy_revision+1,id=randomUUID();
  await c.query(`INSERT INTO backup_policies(id,device_id,revision,source_dirs,excludes,days,time,timezone,retention_successful_count,consistency_profile,compression,enabled) VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9,$10,$11,$12)`,[id,deviceId,revision,JSON.stringify(p.sourceDirs),JSON.stringify(p.excludes),JSON.stringify(p.days),p.time,p.timezone,p.retentionSuccessfulCount,p.consistencyProfile,p.compression,p.enabled]);
  await c.query('UPDATE backup_devices SET policy_revision=$2 WHERE id=$1',[deviceId,revision]);return {id,deviceId,revision,...p};
 });
}
