import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,writeFile,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCloudApp } from '../lib/cloud-app.js';

test('installer download streams the fixed release, supports ranges and keeps other files private',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'isabella-download-'));
  const installerPath=join(directory,'release.exe');
  const payload=Buffer.from('MZ-isabella-installer-fixture');
  await writeFile(installerPath,payload);
  await writeFile(join(directory,'secret.json'),'private');
  const server=createCloudApp({store:{},vaultKey:Buffer.alloc(32),installerPath}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const response=await fetch(`${base}/downloads/Isabella-Setup.exe?path=secret.json`);
    assert.equal(response.status,200);
    assert.match(response.headers.get('content-disposition'),/attachment; filename="Isabella-Setup.exe"/);
    assert.match(response.headers.get('cache-control'),/no-store/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),payload);
    const partial=await fetch(`${base}/downloads/Isabella-Setup.exe`,{headers:{Range:'bytes=0-1'}});
    assert.equal(partial.status,206);
    assert.equal(await partial.text(),'MZ');
    assert.equal((await fetch(`${base}/downloads/secret.json`)).status,404);
    await rm(installerPath);
    const missing=await fetch(`${base}/downloads/Isabella-Setup.exe`);
    assert.equal(missing.status,503);
    assert.equal((await missing.json()).error,'El instalador todavía no está disponible.');
  } finally {
    await new Promise(resolve=>server.close(resolve));
    await rm(directory,{recursive:true,force:true});
  }
});
