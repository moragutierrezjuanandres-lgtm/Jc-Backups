import {selectBackupState} from './backup-state.js';
function localParts(time,timezone){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(time));return Object.fromEntries(parts.filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));}
function stamp(parts){return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;}
export function backupIsCurrent(snapshot,policy,now=Date.now()) {
 if(!snapshot?.verified_at||snapshot.retained===false)return false;
 if(!policy?.enabled)return true;
 try {
  const timezone=policy.timezone||'America/Caracas',local=localParts(now,timezone),current=stamp(local);
  const day=new Date(Date.UTC(Number(local.year),Number(local.month)-1,Number(local.day)));
  for(let i=0;i<8;i++) {const date=new Date(day.getTime()-i*86400000);if(!policy.days?.includes(date.getUTCDay()))continue;const due=date.toISOString().slice(0,10)+' '+policy.time;if(due>current)continue;return stamp(localParts(snapshot.verified_at,timezone))>=due;}
  return false;
 }catch{return false;}
}
export function selectedEquipmentState({device,runs=[],alerts=[],snapshots=[],policies=[],connection='connected',now=Date.now()}) {
 if(!device)return {emotion:'guiding',message:'Selecciona un equipo para revisar sus respaldos.',progress:null};
 if(device.status==='revoked')return {emotion:'alert',message:'Este equipo está revocado.',progress:null,transferring:false};
 const ownRuns=runs.filter(r=>r.device_id===device.id),ownAlerts=alerts.filter(a=>a.device_id===device.id);
 const base=selectBackupState({runs:ownRuns,alerts:ownAlerts,devices:[device],connection,now});
 const transferring=base.run?.status==='running';
 const snapshot=snapshots.find(s=>s.device_id===device.id&&s.retained!==false),policy=policies.find(p=>p.deviceId===device.id);
 if(!base.run&&connection==='connected'&&!ownAlerts.length&&!['failed','partial','interrupted'].includes(ownRuns[0]?.status)){
  if(backupIsCurrent(snapshot,policy,now))return {...base,emotion:'success',message:`${device.label}: respaldos al día. Última copia verificada.`,progress:100,transferring:false};
  if(snapshot&&policy?.enabled)return {...base,emotion:'alert',message:`${device.label}: hay un respaldo programado pendiente.`,progress:null,transferring:false};
  if(base.emotion==='success'&&!snapshot)return {...base,emotion:'idle',message:'Esperando una copia verificada disponible.',progress:null,transferring:false};
 }
 return {...base,transferring};
}
