import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { initializeBackupSchema } from '../lib/backup/schema.js';
import { BackupAuth, canManageBackups, canReadClient } from '../lib/backup/auth.js';

test('only explicit backup operators manage devices and clients see their own data',()=>{
 assert.equal(canManageBackups({role:'Administrador'}),true);
 assert.equal(canManageBackups({role:'Técnico',allowedSections:['clients']}),false);
 assert.equal(canManageBackups({role:'Técnico'}),false);
 assert.equal(canManageBackups({role:'Técnico',allowedSections:['backups']}),true);
 assert.equal(canReadClient({role:'Cliente',clientId:'a'},'a'),true);
 assert.equal(canReadClient({role:'Cliente',clientId:'a'},'b'),false);
});

test('one-time enrollment, expiration, token hashing and revocation',async()=>{
 const db=new PGlite(); let gate=Promise.resolve();
 const query=(s,p)=>p?db.query(s,p):db.exec(s).then(r=>r.at(-1));
 async function acquire(){let release;const prior=gate;gate=new Promise(r=>release=r);await prior;return release;}
 const pool={async query(s,p){const release=await acquire();try{return await query(s,p);}finally{release();}},async connect(){const release=await acquire();return {query,release};}};
 await initializeBackupSchema(pool);
 let provisions=0,revocations=0;
 const receiver={async provision({deviceId}){provisions++;return {repositoryId:deviceId,url:'https://backup.test/'+deviceId,username:deviceId,password:'repository-password',key:'encryption-key'};},async revoke(){revocations++;}};
 const auth=new BackupAuth(pool,randomBytes(32),receiver);
 try {
  const now=new Date('2026-09-29T12:00:00Z');
  const code=await auth.createEnrollment('cli-001','admin',now);
  assert.equal(code.expiresAt,'2026-09-29T12:10:00.000Z');
  await assert.rejects(auth.enroll(code.code,'Equipo A',now),e=>e.status===403);
  await assert.rejects(auth.enroll(code.code,'Equipo A',now,{role:'Cliente',clientId:'other'}),e=>e.status===403);
  const user={role:'Administrador',id:'admin'};
  const results=await Promise.allSettled([auth.enroll(code.code,'Equipo A',now,user),auth.enroll(code.code,'Equipo B',now,user)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const result=results.find(r=>r.status==='fulfilled').value;
  assert.equal(provisions,1);
  assert.equal((await auth.authenticate('Bearer '+result.token)).client_id,'cli-001');
  const stored=(await pool.query('SELECT token_hash,repository_secret FROM backup_devices WHERE token_hash IS NOT NULL')).rows[0];
  assert.ok(stored.repository_secret);
  assert.ok(!stored.repository_secret.includes('encryption-key'));
  assert.ok(!stored.token_hash.includes(result.token));
  await assert.rejects(auth.authenticate('Bearer wrong'),e=>e.status===401);
  const expired=await auth.createEnrollment('cli-001','admin',now);
  await assert.rejects(auth.enroll(expired.code,'Too late',new Date('2026-09-29T12:10:00Z')),e=>e.status===401);
  await auth.revoke(result.deviceId);
  assert.equal(revocations,1);
  await assert.rejects(auth.authenticate('Bearer '+result.token),e=>e.status===401);
 } finally {await db.close();}
});
