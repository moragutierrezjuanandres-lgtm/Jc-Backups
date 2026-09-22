import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readSnapshot } from '../server/import-snapshot.mjs';
test('snapshot reader preserves collections and revision without creating a missing database',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jc-migration-'));
  try {
    assert.throws(()=>readSnapshot(path.join(dir,'missing.sqlite')));
    assert.equal(fs.existsSync(path.join(dir,'missing.sqlite')),false);
    const file=path.join(dir,'source.sqlite');const db=new DatabaseSync(file);
    db.exec("CREATE TABLE collections(name TEXT PRIMARY KEY,data TEXT); CREATE TABLE meta(key TEXT PRIMARY KEY,value INTEGER); INSERT INTO meta VALUES('revision',64)");
    db.prepare('INSERT INTO collections VALUES(?,?)').run('clients',JSON.stringify([{id:'c1',name:'José'}]));db.close();
    assert.deepEqual(readSnapshot(file),{collections:{clients:[{id:'c1',name:'José'}]},revision:64});
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
