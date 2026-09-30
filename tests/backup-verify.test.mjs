import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { verifySnapshot } from '../server/backup-receiver/verify.mjs';
const run=promisify(execFile);
test('real compressed snapshot verifies and restores identical bytes',{skip:!process.env.JC_TEST_RESTIC},async()=>{
 const root=await mkdtemp(join(tmpdir(),'isabella-verify-'));
 const binary=process.env.JC_TEST_RESTIC,password='test-only-password',path=join(root,'repository');
 const options={windowsHide:true,env:{...process.env,RESTIC_PASSWORD:password}};
 try {
  const source=join(root,'source');await mkdir(source);const payload=Buffer.from('Isabella real backup fixture\n'.repeat(2000));await writeFile(join(source,'fixture.txt'),payload);
  await run(binary,['-r',path,'init','--repository-version','2'],options);
  await run(binary,['-r',path,'backup','--compression','auto','fixture.txt'],{...options,cwd:source});
  const {stdout}=await run(binary,['-r',path,'snapshots','--json'],options);const snapshotId=JSON.parse(stdout)[0].id;
  assert.equal(await verifySnapshot({binary,path,password,snapshotId}),snapshotId);
  await assert.rejects(verifySnapshot({binary,path,password,snapshotId:'../bad'}),/invalid_snapshot/);
  const target=join(root,'restored');await run(binary,['-r',path,'restore',snapshotId,'--target',target,'--include','**/fixture.txt'],options);
  assert.deepEqual(await readFile(join(target,'fixture.txt')),payload);
 } finally {await rm(root,{recursive:true,force:true})}
});
