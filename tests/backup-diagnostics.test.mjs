import test from 'node:test';import assert from 'node:assert/strict';import {diagnoseBackup} from '../lib/backup/diagnostics.js';
const now=Date.now(),device={label:'Servidor',last_seen_at:new Date(now).toISOString()};
test('diagnostics report real failures, offline state and pending cancellation without inventing actions',()=>{
 assert.match(diagnoseBackup({device,run:{status:'failed'},event:{payload:{exitCode:12}},message:'por qué no funciona',now}),/listar las claves/);
 assert.match(diagnoseBackup({device:{...device,last_seen_at:null},run:{status:'succeeded'},message:'estado',now}),/No recibo comunicación/);
 assert.match(diagnoseBackup({device,run:{status:'running',cancel_requested:true},message:'estado',now}),/Todavía espero/);
 assert.match(diagnoseBackup({device,message:'detener',now}),/no ejecuta órdenes/);
});
