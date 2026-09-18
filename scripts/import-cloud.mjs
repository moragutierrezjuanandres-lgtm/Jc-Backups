import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { dataDirectory } from '../lib/paths.js';

if(fs.existsSync('.env'))process.loadEnvFile('.env');
const directory=dataDirectory();
const origin=new URL(process.argv[2]||'https://www.jcevnzl.space');
if(origin.protocol!=='https:'||origin.username||origin.password)throw new Error('Se requiere el origen HTTPS del portal.');
const token=fs.readFileSync(path.join(directory,'..','cloud-import-token'),'utf8').trim();
const snapshotDir=path.join(directory,'..','snapshots','pre-cloud-'+new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(snapshotDir,{recursive:true,mode:0o700});
const live=new DatabaseSync(path.join(directory,'portal.sqlite'),{readOnly:true});
try{await backup(live,path.join(snapshotDir,'portal.sqlite'));}finally{live.close();}
fs.copyFileSync(path.join(directory,'vault.key'),path.join(snapshotDir,'vault.key'));
const snapshot=new DatabaseSync(path.join(snapshotDir,'portal.sqlite'),{readOnly:true});
const collections=Object.fromEntries(snapshot.prepare('SELECT name,data FROM collections').all().map(row=>[row.name,JSON.parse(row.data)]));
const revision=snapshot.prepare("SELECT value FROM meta WHERE key='revision'").get().value;
snapshot.close();
for(const user of collections.employees||[])delete user.password;
const response=await fetch(new URL('/api/setup/import',origin),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({collections,revision}),signal:AbortSignal.timeout(60000)});
const result=await response.json().catch(()=>({error:'Respuesta de importación inválida.'}));
if(!response.ok)throw new Error(`${response.status}: ${result.error}`);
console.log(JSON.stringify({...result,snapshot:snapshotDir}));
