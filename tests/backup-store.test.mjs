import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { initializeBackupSchema } from '../lib/backup/schema.js';
import { BackupRepository } from '../lib/backup/repository.js';

const db = new PGlite();
let gate = Promise.resolve();
async function acquire() { const previous=gate; let release; gate=new Promise(resolve=>release=resolve); await previous; return release; }
const query=(sql,args)=>args?db.query(sql,args):db.exec(sql).then(results=>results.at(-1)||{rows:[]});
const pool={async query(sql,args){const release=await acquire();try{return await query(sql,args);}finally{release();}},async connect(){const release=await acquire();return {query,release};}};
await initializeBackupSchema(pool);
const repo=new BackupRepository(pool);
const deviceId='00000000-0000-4000-8000-000000000001';
await pool.query("INSERT INTO backup_devices(id,client_id,label) VALUES($1,'c1','Server')",[deviceId]);

test('enqueue is idempotent and an atomically claimed run is leased only once',async()=>{
  const first=await repo.enqueue(deviceId,'scheduled:2026-09-26',1);
  const second=await repo.enqueue(deviceId,'scheduled:2026-09-26',1);
  assert.equal(first.id,second.id);
  const [a,b]=await Promise.all([repo.claim(deviceId,new Date()),repo.claim(deviceId,new Date())]);
  assert.equal([a,b].filter(Boolean).length,1);
  assert.equal((a||b).attempt,1);
  await repo.appendEvent(deviceId,{runId:first.id,attempt:1,sequence:1,kind:'result',payload:{exitCode:0,snapshotId:'snap-first'}},new Date(),{verified:true});
});

test('duplicate result event cannot consume an attempt and first failure waits fifteen minutes',async()=>{
  const run=await repo.enqueue(deviceId,'manual:1',1);
  await repo.claim(deviceId,new Date('2026-09-26T12:00:00Z'));
  const event={runId:run.id,attempt:1,sequence:1,kind:'result',payload:{exitCode:3,errorCode:'partial'}};
  const first=await repo.appendEvent(deviceId,event,new Date('2026-09-26T12:01:00Z'));
  const second=await repo.appendEvent(deviceId,event,new Date('2026-09-26T12:02:00Z'));
  assert.equal(first.status,'retry_wait');
  assert.equal(first.retryAt,'2026-09-26T12:16:00.000Z');
  assert.equal(second.retryAt,first.retryAt);
  assert.equal(await repo.claim(deviceId,new Date('2026-09-26T12:15:59Z')),null);
  assert.equal((await repo.claim(deviceId,new Date('2026-09-26T12:16:00Z'))).attempt,2);
  const ended=await repo.appendEvent(deviceId,{...event,attempt:2,sequence:1},new Date('2026-09-26T12:17:00Z'));
  assert.equal(ended.status,'failed');
  assert.equal(await repo.claim(deviceId,new Date('2026-09-26T13:00:00Z')),null);
});

test('database rejects a third attempt',async()=>{
  const run=await repo.enqueue(deviceId,'manual:2',1);
  await assert.rejects(pool.query('UPDATE backup_runs SET attempts_started=3 WHERE id=$1',[run.id]));
});

test.after(async()=>db.close());
test('successful agent report is acknowledged pending independent verification without inventing a verified snapshot',async()=>{
 const device='00000000-0000-4000-8000-000000000002';
 await pool.query("INSERT INTO backup_devices(id,client_id,label) VALUES($1,'c1','Other')",[device]);
 const run=await repo.enqueue(device,'manual:pending-verification',1);
 const claimed=await repo.claim(device,new Date('2026-09-30T12:00:00Z'));
 assert.equal(claimed.id,run.id);
 const event={runId:run.id,attempt:1,sequence:2,kind:'result',payload:{exitCode:0,snapshotId:'reported-only'}};
 assert.equal((await repo.appendEvent(device,event)).status,'verifying');
 assert.equal((await repo.appendEvent(device,event)).status,'verifying');
 assert.equal((await pool.query('SELECT * FROM backup_snapshots WHERE run_id=$1',[run.id])).rows.length,0);
});
