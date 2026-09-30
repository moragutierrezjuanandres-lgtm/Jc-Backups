import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,lstat,rename} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDirectoryManager,validateServerDirectory,recoverDirectoryChanges} from '../server/backup-receiver/directory.mjs';
import {repositoryIdentity} from '../server/backup-receiver/provision.mjs';
const id='abc12345-abcd-4abc-8abc-123456789abc',repo=repositoryIdentity('client',id);
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),'isabella-directory-'));t.after(()=>rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100}));
 const storageRoot=join(root,'receiver'),source=join(storageRoot,repo),target=join(root,'custom');await mkdir(source,{recursive:true});await writeFile(join(source,'config'),'verified-config');
 const device={id,status:'active',repository_id:repo,storage_moving:false};
 async function query(sql,params){
  if(sql.startsWith('SELECT * FROM backup_devices'))return {rows:[device]};
  if(sql.startsWith('SELECT id,repository_id'))return {rows:device.storage_moving?[device]:[]};
  if(sql.startsWith('SELECT id FROM backup_runs'))return {rows:[]};
  if(sql.startsWith('UPDATE backup_devices')){device.storage_moving=sql.includes('storage_moving=true');if(params?.length>1)device.server_directory=params[1];}
  return {rows:[]};
 }
 const pool={query,async connect(){return {query,release(){}};}};
 return {root,storageRoot,source,target,device,pool};
}
test('moves real files and preserves the receiver URL using a Windows junction',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t),manager=createDirectoryManager(f);const result=await manager(id,f.target);
 assert.equal(await readFile(join(result.repositoryPath,'config'),'utf8'),'verified-config');
 assert.equal(await readFile(join(f.source,'config'),'utf8'),'verified-config');
 assert.equal((await lstat(f.source)).isSymbolicLink(),true);
 assert.equal(await readFile(join(result.previousCopy,'config'),'utf8'),'verified-config');
 assert.equal(f.device.server_directory,f.target);assert.equal(f.device.storage_moving,false);
 assert.equal((await manager(id,f.target)).repositoryPath,result.repositoryPath);
});
test('active transfers and Restic locks prevent relocation without losing originals',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t);await assert.rejects(createDirectoryManager({...f,isReceiving:()=>true})(id,f.target),e=>e.status===409);
 assert.equal(f.device.storage_moving,false);assert.equal(await readFile(join(f.source,'config'),'utf8'),'verified-config');
 await mkdir(join(f.source,'locks'));await writeFile(join(f.source,'locks','lock'),'busy');
 await assert.rejects(createDirectoryManager(f)(id,f.target),e=>e.status===409);
 assert.equal(f.device.storage_moving,false);
});
test('rejects relative, volume, internal and alternate data stream destinations',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t);
 for(const value of ['relative','C:\\','\\folder',f.storageRoot,join(f.storageRoot,'inside'),f.root,'C:\\Backups:stream'])assert.throws(()=>validateServerDirectory(value,f),e=>e.status===400);
 assert.equal(validateServerDirectory(f.target,f),f.target);
});
test('recovers the original path after interruption between rename and junction',{skip:process.platform!=='win32'},async t=>{
 const f=await fixture(t);await rename(f.source,f.source+'.previous-test');f.device.storage_moving=true;
 await recoverDirectoryChanges(f);assert.equal(await readFile(join(f.source,'config'),'utf8'),'verified-config');assert.equal(f.device.storage_moving,false);
});
