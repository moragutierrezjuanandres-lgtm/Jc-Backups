import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { Store, passwordMatches } from '../lib/store.js';
import { migrateData } from '../scripts/migrate-data.mjs';

test('migration preserves records, password hashes, sessions, agents and encryption key across restart', async () => {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'jc-migration-'));
  const root=path.join(temporary,'code'), destination=path.join(temporary,'private');
  fs.mkdirSync(root);
  const legacy=path.join(root,'database.json');
  fs.writeFileSync(legacy,JSON.stringify({employees:[{id:'admin',password:'migration-test-password'}],clients:[{id:'client-1'}]}));
  const store=new Store(path.join(root,'data'),legacy);
  store.sql.prepare('INSERT INTO sessions VALUES (?,?,?)').run('session','admin',Date.now()+100000);
  store.sql.prepare('INSERT INTO agents VALUES (?,?,?,?)').run('client-1','26.1.1.1','test-secret','{}');
  store.saveJob({id:'job',clientId:'client-1',status:'completed'});
  const key=randomBytes(32);fs.writeFileSync(path.join(root,'data','vault.key'),key);
  fs.writeFileSync(path.join(root,'.env'),'PORT=5000\nJC_WHATSAPP=0\n');
  // Keep WAL open to exercise SQLite's consistent backup API.
  await migrateData({root,destination,port:0});
  store.close();
  const migrated=new Store(destination);
  try {
    assert.deepEqual(migrated.get('clients'),[{id:'client-1'}]);
    assert.ok(passwordMatches('migration-test-password',migrated.get('employees')[0].passwordHash));
    assert.equal(migrated.sql.prepare('SELECT count(*) AS n FROM sessions').get().n,1);
    assert.equal(migrated.sql.prepare('SELECT count(*) AS n FROM agents').get().n,1);
    assert.equal(migrated.job('job').status,'completed');
    assert.deepEqual(fs.readFileSync(path.join(destination,'vault.key')),key);
    assert.match(fs.readFileSync(path.join(root,'.env'),'utf8'),/JC_WHATSAPP=0/);
    assert.ok(fs.existsSync(legacy));
  } finally {migrated.close();}
  await assert.rejects(migrateData({root,destination,port:0}),/No se sobrescribieron/);
  await assert.rejects(migrateData({root,destination:path.join(root,'nested'),port:0}),/independiente/);
  fs.rmSync(temporary,{recursive:true,force:true});
});

test('migration refuses a listening server before copying files',async()=>{
  const server=net.createServer();
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { await assert.rejects(migrateData({port:server.address().port}),/Detén el servidor/); }
  finally { await new Promise(resolve=>server.close(resolve)); }
});
