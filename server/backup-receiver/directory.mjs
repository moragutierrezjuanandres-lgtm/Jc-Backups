import { cp,mkdir,lstat,realpath,rename,symlink,unlink,readdir,stat } from 'node:fs/promises';
import { resolve,join,relative,parse,win32,dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { repositoryPath } from './provision.mjs';
const fail=(status,message)=>Object.assign(new Error(message),{status});
const within=(parent,child)=>{const r=relative(parent,child);return !r||(!r.startsWith('..')&&!parse(r).root);};
export function validateServerDirectory(value,{storageRoot,protectedRoots=[]}={}) {
 if(typeof value!=='string'||!win32.isAbsolute(value)||! /^[A-Za-z]:[\\/]/.test(value)||/[\x00-\x1f<>"|?*]/.test(value)||value.slice(2).includes(':')||value.startsWith('\\\\'))throw fail(400,'Indica una carpeta local absoluta del servidor, por ejemplo D:\\Respaldos\\Cliente.');
 const directory=resolve(value.trim());
 if(directory===parse(directory).root)throw fail(400,'Selecciona una carpeta dentro de la unidad.');
 const blocked=[storageRoot,...protectedRoots,process.env.WINDIR,process.env.ProgramFiles,process.env['ProgramFiles(x86)']].filter(Boolean).map(resolvePath=>resolve(resolvePath));
 if(blocked.some(root=>within(root,directory)||within(directory,root)))throw fail(400,'La carpeta debe estar fuera del sistema, la aplicación y el almacenamiento interno.');
 return directory;
}
export function createDirectoryManager({pool,storageRoot,protectedRoots=[],isReceiving=()=>false}) {
 const manager=async(deviceId,input)=>{
  const directory=validateServerDirectory(input,{storageRoot,protectedRoots});
  await mkdir(directory,{recursive:true});
  const physical=await realpath(directory);
  validateServerDirectory(physical,{storageRoot,protectedRoots});
  const client=await pool.connect();let previous,source,target,moving=false,switched=false;
  try {
   await client.query('BEGIN');
   const device=(await client.query('SELECT * FROM backup_devices WHERE id=$1 FOR UPDATE',[deviceId])).rows[0];
   if(!device||device.status!=='active'||!device.repository_id)throw fail(404,'Equipo no disponible.');
   const busy=(await client.query(`SELECT id FROM backup_runs WHERE device_id=$1 AND status IN ('running','verifying') UNION ALL SELECT id FROM backup_restore_jobs WHERE device_id=$1 AND status='running' LIMIT 1`,[deviceId])).rows[0];
   if(busy||device.storage_moving)throw fail(409,'Espera a que termine el respaldo o la restauración antes de cambiar la carpeta.');
   source=repositoryPath(storageRoot,device.repository_id);target=join(physical,device.repository_id);
   if((await realpath(source)).toLowerCase()===target.toLowerCase()){await client.query('ROLLBACK');return {directory:physical,repositoryPath:target};}
   try{await stat(target);throw fail(409,'La carpeta ya contiene un repositorio con ese nombre. Elige otra ubicación.');}catch(error){if(error.code!=='ENOENT')throw error;}
   await client.query('UPDATE backup_devices SET storage_moving=true WHERE id=$1',[deviceId]);await client.query('COMMIT');moving=true;
   if(isReceiving(device.repository_id))throw fail(409,'El receptor todavía está atendiendo una transferencia. Inténtalo cuando termine.');
   // The proxy denies new uploads while relocating; existing Restic locks must be absent.
   let locks=[];try{locks=await readdir(join(source,'locks'));}catch(error){if(error.code!=='ENOENT')throw error;}
   if(locks.length)throw fail(409,'El repositorio está en uso. Intenta cambiar la carpeta cuando termine la tarea.');
   const stage=target+'.pending-'+randomUUID();await cp(source,stage,{recursive:true,dereference:true,errorOnExist:true,force:false});await rename(stage,target);
   previous=source+'.previous-'+randomUUID();await rename(source,previous);
   try {await symlink(target,source,'junction');switched=true;}catch(error){await rename(previous,source);previous=null;throw error;}
   await client.query('UPDATE backup_devices SET server_directory=$2,storage_moving=false WHERE id=$1',[deviceId,physical]);moving=false;
   return {directory:physical,repositoryPath:target,previousCopy:previous};
  }catch(error){
   await client.query('ROLLBACK').catch(()=>{});
   if(switched&&previous){const info=await lstat(source);if(info.isSymbolicLink()){await unlink(source);await rename(previous,source);}}
   if(moving)await client.query('UPDATE backup_devices SET storage_moving=false WHERE id=$1',[deviceId]);
   if(error.status)throw error;
   throw fail(503,'No se pudo guardar en esa carpeta. Comprueba permisos, espacio disponible y acceso del servidor. La copia anterior se conserva.');
  }finally{client.release();}
 };
 manager.defaultDirectory=storageRoot;
 return manager;
}
export async function recoverDirectoryChanges({pool,storageRoot}) {
 const devices=(await pool.query('SELECT id,repository_id FROM backup_devices WHERE storage_moving=true')).rows;
 for(const device of devices){
  const source=repositoryPath(storageRoot,device.repository_id);
  try{await stat(join(source,'config'));}catch(error){
   if(error.code!=='ENOENT')throw error;
   const prior=(await readdir(storageRoot)).filter(name=>name.startsWith(device.repository_id+'.previous-')).sort().at(-1);
   if(!prior)throw new Error('storage_recovery_required');
   await rename(join(storageRoot,prior),source);
  }
  const physical=await realpath(source),linked=(await lstat(source)).isSymbolicLink();
  await pool.query('UPDATE backup_devices SET storage_moving=false,server_directory=$2 WHERE id=$1',[device.id,linked?dirname(physical):null]);
 }
}
