import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { isDeepStrictEqual } from 'node:util';
import { PostgresStore } from '../lib/postgres.js';
import { dataDirectory } from '../lib/paths.js';

if(fs.existsSync('.env'))process.loadEnvFile('.env');
if(fs.existsSync('.env.neon'))process.loadEnvFile('.env.neon');
const directory=dataDirectory();
const destination=path.join(directory,'..','snapshots','pre-neon-'+new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(destination,{recursive:true,mode:0o700});
const live=new DatabaseSync(path.join(directory,'portal.sqlite'),{readOnly:true});
try{await backup(live,path.join(destination,'portal.sqlite'));}finally{live.close();}
fs.copyFileSync(path.join(directory,'vault.key'),path.join(destination,'vault.key'));
const snapshot=new DatabaseSync(path.join(destination,'portal.sqlite'),{readOnly:true});
const data=Object.fromEntries(snapshot.prepare('SELECT name,data FROM collections').all().map(r=>[r.name,JSON.parse(r.data)]));
const revision=snapshot.prepare("SELECT value FROM meta WHERE key='revision'").get().value;
snapshot.close();
if(!data.employees?.some(e=>e.role==='Administrador'&&e.status==='Activo'&&e.passwordHash))throw new Error('No hay un administrador válido; importación cancelada.');
for(const employee of data.employees)delete employee.password;
const store=new PostgresStore(process.env.DATABASE_URL);
try{
  await store.initialize();
  await store.transaction(true,async(state,client)=>{
    if(Object.keys(state.read()).length)throw new Error('Neon ya tiene datos. No se sobrescribieron.');
    for(const [name,records]of Object.entries(data))state.put(name,records);
    state.version=revision;
    await client.query('INSERT INTO jc_imports(id,summary) VALUES($1,$2::jsonb)',['sqlite-initial',JSON.stringify({collections:Object.keys(data).length,clients:data.clients?.length,employees:data.employees.length,tickets:data.tickets?.length})]);
  });
  const copied=await store.transaction(false,state=>state.read());
  if(!isDeepStrictEqual(data,copied))throw new Error('Los datos importados no coinciden.');
  console.log(JSON.stringify({imported:true,verified:true,clients:data.clients?.length,employees:data.employees.length,tickets:data.tickets?.length,snapshot:destination}));
}finally{await store.close();}
