import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceState, scopeBackups, makePolicy } from '../src/utils/backupView.js';
test('scope keeps devices and failures separated by client and equipment',()=>{
 const data={devices:[{id:'a',clientId:'1'},{id:'b',clientId:'1'},{id:'c',clientId:'2'}],runs:[{deviceId:'a',clientId:'1'},{deviceId:'b',clientId:'1'},{deviceId:'c',clientId:'2'}],alerts:[{deviceId:'c',clientId:'2'}]};
 assert.deepEqual(scopeBackups(data,'1','a').runs,[data.runs[0]]);
 assert.equal(scopeBackups(data,'1').devices.length,2);
 assert.deepEqual(scopeBackups(data,'1').alerts,[]);
});
test('missing heartbeat is never connected and revoked stays revoked',()=>{
 assert.equal(deviceState({},1000000),'Sin conexión');
 assert.equal(deviceState({lastSeenAt:new Date(999999).toISOString()},1000000),'Conectado');
 assert.equal(deviceState({status:'revoked',lastSeenAt:new Date(999999).toISOString()},1000000),'Revocado');
});
test('policy preserves Windows folders, validates days and defaults disabled',()=>{
 const p=makePolicy({sourceText:'C:\\Datos\nD:\\Clientes con espacios',days:[1,3],time:'22:00',timezone:'America/Caracas',retentionSuccessfulCount:7});
 assert.equal(p.sourceDirs.length,2); assert.equal(p.enabled,false);
 assert.throws(()=>makePolicy({...p,sourceText:'C:\\Datos',days:[]}));
 assert.throws(()=>makePolicy({...p,sourceText:'C:\\Datos',time:'25:00'}));
});
