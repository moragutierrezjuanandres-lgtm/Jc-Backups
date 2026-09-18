import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { randomBytes } from 'node:crypto';
import { PostgresStore } from '../lib/postgres.js';
import { createCloudApp } from '../lib/cloud-app.js';
import { passwordHash } from '../lib/auth.js';
import { authorizedImport, importCollections } from '../lib/cloud-import.js';

// Run actual PostgreSQL SQL locally; no production credentials or records are used.
const db=new PGlite();
let gate=Promise.resolve();
async function acquire(){const prior=gate;let release;gate=new Promise(r=>release=r);await prior;return release;}
const query=(sql,args)=>args?db.query(sql,args):db.exec(sql).then(results=>results.at(-1)||{rows:[]});
const pool={on(){},async query(sql,args){const release=await acquire();try{return await query(sql,args);}finally{release();}},async connect(){const release=await acquire();return {query,release};},end:()=>db.close()};
const store=new PostgresStore(null,pool);
await store.initialize();
const initial={employees:[{id:'admin',name:'Admin',email:'admin@test.local',passwordHash:passwordHash('cloud-test-password'),role:'Administrador',status:'Activo'},{id:'client',name:'Client',email:'client@test.local',passwordHash:passwordHash('cloud-test-password'),role:'Cliente',clientId:'c1',status:'Activo'}],clients:[{id:'c1',commercialName:'Cliente de prueba',phone:'111',address:'A'}],tickets:[{id:'t1',clientId:'c1'},{id:'t2',clientId:'other'}],projects:[],auditLogs:[]};
await store.transaction(true,state=>{for(const [name,value]of Object.entries(initial))state.put(name,value);});
const key=randomBytes(32);
const app=createCloudApp({store,vaultKey:key,secureCookie:false});
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const base=`http://127.0.0.1:${server.address().port}`;
async function request(route,{method='GET',body,cookie,origin}={}){const r=await fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]};}
const login=await request('/api/auth/login',{method:'POST',body:{username:'admin',password:'cloud-test-password'}});
const cookie=login.cookie;
test('cloud login uses hashed passwords and private persistent sessions',async()=>{
  assert.equal(login.status,200);assert.ok(cookie);assert.equal(login.body.user.passwordHash,undefined);
  assert.equal((await request('/api/auth/session')).status,401);
  assert.equal((await request('/api/auth/session',{cookie})).status,200);
  assert.equal((await store.pool.query('SELECT count(*) AS n FROM jc_sessions')).rows[0].n,1);
});
test('cloud merges unrelated edits and rolls back every change on conflict',async()=>{
  const before=initial.clients[0];
  const update=changes=>request('/api/db',{method:'PATCH',cookie,body:{changes}});
  assert.equal((await update([{collection:'clients',id:'c1',before,after:{...before,phone:'222'}}])).status,200);
  assert.equal((await update([{collection:'clients',id:'c1',before,after:{...before,address:'B'}}])).status,200);
  assert.equal((await update([{collection:'clients',id:'new',before:null,after:{id:'new'}},{collection:'clients',id:'c1',before,after:{...before,phone:'333'}}])).status,409);
  const clients=await store.transaction(false,state=>state.get('clients'));
  assert.equal(clients.length,1);assert.equal(clients[0].phone,'222');assert.equal(clients[0].address,'B');
});
test('cloud rejects another origin and restricts client data',async()=>{
  assert.equal((await request('/api/db',{method:'PATCH',cookie,origin:'https://evil.test',body:{changes:[]}})).status,403);
  const client=await request('/api/auth/login',{method:'POST',body:{username:'client',password:'cloud-test-password'}});
  assert.equal(client.status,200);assert.equal(client.body.db.tickets.length,1);assert.deepEqual(client.body.db.clients,[]);
});
test('cloud encryption survives a separate server instance',async()=>{
  const encrypted=await request('/api/vault/encrypt',{method:'POST',cookie,body:{text:'test-private-value'}});
  const other=createCloudApp({store,vaultKey:key,secureCookie:false});
  const second=await new Promise(resolve=>{const s=other.listen(0,'127.0.0.1',()=>resolve(s));});
  try{const r=await fetch(`http://127.0.0.1:${second.address().port}/api/vault/decrypt`,{method:'POST',headers:{Cookie:cookie,'Content-Type':'application/json'},body:JSON.stringify({value:encrypted.body.value})});assert.equal(r.status,200);assert.equal((await r.json()).value,'test-private-value');}
  finally{await new Promise(resolve=>second.close(resolve));}
});
test('cloud rate limit persists across failed transactions',async()=>{
  for(let n=0;n<10;n++)assert.equal((await request('/api/auth/login',{method:'POST',body:{username:'unknown',password:'wrong'}})).status,401);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{username:'unknown',password:'wrong'}})).status,429);
});
test('cloud does not report successful backups without a coordinator',async()=>{const result=await request('/api/backups/request',{method:'POST',cookie,body:{clientId:'c1'}});assert.equal(result.status,503);});
test('cloud logout revokes session in the database',async()=>{assert.equal((await request('/api/auth/logout',{method:'POST',cookie,body:{}})).status,200);assert.equal((await request('/api/auth/session',{cookie})).status,401);});
test('one-time cloud import verifies all records and rejects overwrite',async()=>{
  const temporary=new PGlite();
  const run=(sql,args)=>args?temporary.query(sql,args):temporary.exec(sql).then(r=>r.at(-1)||{rows:[]});
  const isolated=new PostgresStore(null,{on(){},query:run,async connect(){return {query:run,release(){}};},end:()=>temporary.close()});
  try{
    const data=structuredClone(initial);
    const result=await importCollections(isolated,data,42);
    assert.equal(result.verified,true);
    assert.deepEqual(await isolated.transaction(false,s=>s.read()),data);
    assert.equal(await isolated.transaction(false,s=>s.revision()),42);
    await assert.rejects(importCollections(isolated,{...data,clients:[]}),error=>error.status===409);
    assert.deepEqual(await isolated.transaction(false,s=>s.get('clients')),data.clients);
    assert.equal(authorizedImport('Bearer wrong','a'.repeat(96)),false);
    assert.equal(authorizedImport('Bearer '+ 'a'.repeat(96),'a'.repeat(96)),true);
    assert.equal((await request('/api/setup/import',{method:'POST',body:{collections:data}})).status,404);
  }finally{await isolated.close();}
});
test.after(async()=>{await new Promise(resolve=>server.close(resolve));await store.close();});
