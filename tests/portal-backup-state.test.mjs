import test from 'node:test';
import assert from 'node:assert/strict';
import {backupIsCurrent,selectedEquipmentState} from '../src/components/portal-backup-state.js';
const now=Date.parse('2026-09-30T15:00:00Z');
const device={id:'a',label:'Servidor',status:'active'};
const policy={deviceId:'a',enabled:true,days:[0,1,2,3,4,5,6],time:'10:00',timezone:'America/Caracas'};
test('green requires a retained verified copy covering the latest scheduled time',()=>{
 assert.equal(backupIsCurrent({verified_at:'2026-09-30T14:30:00Z'},policy,now),true);
 assert.equal(backupIsCurrent({verified_at:'2026-09-29T14:30:00Z'},policy,now),false);
 assert.equal(backupIsCurrent({verified_at:'2026-09-29T14:30:00Z'},policy,Date.parse('2026-09-30T13:30:00Z')),true);
 assert.equal(backupIsCurrent({verified_at:'2026-09-30T14:30:00Z',retained:false},policy,now),false);
 const state=selectedEquipmentState({device,policies:[policy],snapshots:[{device_id:'a',verified_at:'2026-09-30T14:30:00Z'}],runs:[{device_id:'b',status:'running'}],now});
 assert.equal(state.emotion,'success');assert.equal(state.transferring,false);
 assert.equal(selectedEquipmentState({device,runs:[{device_id:'a',status:'partial'}],snapshots:[{device_id:'a',verified_at:new Date(now).toISOString()}],now}).emotion,'alert');
});
test('blue transfer and percentage are scoped to selected equipment and fresh telemetry',()=>{
 const runs=[{device_id:'a',status:'running',progress:{percent:64.5,updatedAt:new Date(now).toISOString()}}];
 const state=selectedEquipmentState({device,runs,now});assert.equal(state.transferring,true);assert.equal(state.progress,64.5);
 assert.equal(selectedEquipmentState({device,runs,now:now+46000}).progress,null);
 assert.equal(selectedEquipmentState({device:{...device,id:'b'},runs,now}).transferring,false);
 assert.equal(selectedEquipmentState({device:{...device,status:'revoked'},runs,now}).emotion,'alert');
});
