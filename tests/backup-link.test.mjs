import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes, randomUUID } from 'node:crypto';
import { PostgresStore } from '../lib/postgres.js';
import { createCloudApp } from '../lib/cloud-app.js';
import { passwordHash } from '../lib/auth.js';
import { BackupAuth } from '../lib/backup/auth.js';
import { BackupRepository } from '../lib/backup/repository.js';

test('HTTP enrollment requires password session and client code; device status excludes secrets',{timeout:30000},async()=>{
 const db=new PGlite();let gate=Promise.resolve();
 async function acquire(){const prior=gate;let release;gate=new Promise(r=>release=r);await prior;return release;}
 const query=(s,p)=>p?db.query(s,p):db.exec(s).then(r=>r.at(-1));
 const pool={on(){},async query(s,p){const release=await acquire();try{return await query(s,p);}finally{release();}},async connect(){const release=await acquire();return {query,release};},end:()=>db.close()};
 const store=new PostgresStore(null,pool);await store.initialize();
 const password=passwordHash('test-password');
 await store.transaction(true,s=>{s.put('employees',[
 {id:'admin',name:'admin',role:'Administrador',status:'Activo',passwordHash:password},
 {id:'a',name:'a',role:'Cliente',clientId:'cli-a',status:'Activo',passwordHash:password},
 {id:'b',name:'b',role:'Cliente',clientId:'cli-b',status:'Activo',passwordHash:password}]);s.put('clients',[{id:'cli-a'},{id:'cli-b'}]);});
 let provisions=0;const key=randomBytes(32);
 const receiver={async provision({deviceId}){provisions++;return {repositoryId:deviceId,url:'https://backup.test/'+deviceId,username:deviceId,password:'repo-password',key:'repo-key'};},async revoke(){}};
 const auth=new BackupAuth(pool,key,receiver);
 const app=createCloudApp({store,vaultKey:key,secureCookie:false,backupAuth:auth,backupRepository:new BackupRepository(pool),backupReceiverConfigured:true});
 const server=await new Promise(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});const base='http://127.0.0.1:'+server.address().port;
 async function request(path,body,cookie,token){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 try {
  const bad=await request('/api/auth/login',{username:'a',password:'wrong'});assert.equal(bad.status,401);assert.equal(bad.cookie,undefined);
  const admin=await request('/api/auth/login',{username:'admin',password:'test-password'});
  const a=await request('/api/auth/login',{username:'a',password:'test-password'});
  const b=await request('/api/auth/login',{username:'b',password:'test-password'});
  const code=await request('/api/backups/enrollments',{clientId:'cli-a'},admin.cookie);assert.equal(code.status,200);
  const body={code:code.body.code,deviceLabel:'Mi equipo'};
  assert.equal((await request('/api/backup-agent/enroll',body)).status,401);
  assert.equal((await request('/api/backup-agent/enroll',body,b.cookie)).status,403);
  const linked=await request('/api/backup-agent/enroll',body,a.cookie);assert.equal(linked.status,200);assert.equal(provisions,1);
  assert.equal((await request('/api/backup-agent/enroll',body,a.cookie)).status,401);
  assert.equal((await request('/api/backup-agent/status',null,b.cookie,linked.body.token)).status,403);
  const status=await request('/api/backup-agent/status',null,a.cookie,linked.body.token);assert.equal(status.status,200);assert.equal(status.body.device.label,'Mi equipo');assert.ok(!JSON.stringify(status.body).includes('repo-password'));
  const other=await request('/api/backups',null,b.cookie);assert.deepEqual(other.body.devices,[]);
  const policy={sourceDirs:['C:\\Datos'],days:[1,2,3],time:'22:00',enabled:true,compression:'auto'};
  assert.equal((await request('/api/backup-agent/setup-policy',policy,b.cookie,linked.body.token)).status,403);
  assert.equal((await request('/api/backup-agent/setup-policy',{...policy,compression:'off'},a.cookie,linked.body.token)).status,400);
  const saved=await request('/api/backup-agent/setup-policy',policy,a.cookie,linked.body.token);assert.equal(saved.status,200);assert.equal(saved.body.policy.revision,1);
  const received=await request('/api/backup-agent/policy',null,null,linked.body.token);assert.equal(received.body.policy.enabled,true);assert.deepEqual(received.body.policy.sourceDirs,['C:\\Datos']);
  const claim=await request('/api/backup-agent/claim',{},null,linked.body.token);assert.deepEqual(claim.body,{run:null});
  const own=await request('/api/backups',null,a.cookie);assert.equal(own.body.devices.length,1);assert.ok(!JSON.stringify(own.body).includes(linked.body.token));
  const policyPath=`/api/backups/devices/${linked.body.deviceId}/policy`;
  assert.equal((await request(policyPath,null,b.cookie)).status,403);
  assert.equal((await request(policyPath,null,admin.cookie)).body.policy.revision,1);
  assert.equal((await request('/api/backups/runs',{deviceId:linked.body.deviceId},b.cookie)).status,403);
  const manual=await request('/api/backups/runs',{deviceId:linked.body.deviceId},admin.cookie);
  assert.equal(manual.status,200);assert.equal(manual.body.run.status,'queued');
  assert.equal((await request('/api/backup-agent/claim',{},null,linked.body.token)).body.run.id,manual.body.run.id);
  const snapshotRecord=randomUUID();
  assert.equal((await request('/api/backups/restores',{snapshotId:snapshotRecord},a.cookie)).status,403);
  assert.equal((await request('/api/backups/restores',{snapshotId:snapshotRecord},admin.cookie)).status,404);
  assert.equal((await request('/api/backups/restores',{snapshotId:'../x'},admin.cookie)).status,400);
  const runId=randomUUID(),snapshotId='a'.repeat(64);
  await pool.query(`INSERT INTO backup_runs(id,device_id,policy_revision,occurrence_key,status,snapshot_id) VALUES($1,$2,1,'fixture','succeeded',$3)`,[runId,linked.body.deviceId,snapshotId]);
  await pool.query(`INSERT INTO backup_snapshots(id,device_id,run_id,snapshot_id,verified_at) VALUES($1,$2,$3,$4,now())`,[snapshotRecord,linked.body.deviceId,runId,snapshotId]);
  const restore=await request('/api/backups/restores',{snapshotId:snapshotRecord,destinationPath:'C:\\Windows'},admin.cookie);
  assert.equal(restore.status,200);assert.equal(restore.body.job.status,'queued');
  const jobs=await request('/api/backups/restores',null,admin.cookie);assert.equal(jobs.body.jobs.length,1);assert.equal(jobs.body.jobs[0].destination_path,null);
 }finally{await new Promise(r=>server.close(r));await store.close();}
});
