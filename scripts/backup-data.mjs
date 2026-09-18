import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, backup } from 'node:sqlite';
import { dataDirectory, projectRoot } from '../lib/paths.js';
const envFile=path.join(projectRoot,'.env');
if(fs.existsSync(envFile))process.loadEnvFile(envFile);
const directory=dataDirectory();
if(!fs.existsSync(path.join(directory,'portal.sqlite')) || !fs.existsSync(path.join(directory,'vault.key'))) throw new Error('No se encontró la base de datos y su clave; no se creó una copia vacía.');
const destination=path.join(directory,'..','snapshots',new Date().toISOString().replaceAll(':','-'));
fs.mkdirSync(destination,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(directory,'portal.sqlite'),{readOnly:true});
try {
  await backup(db,path.join(destination,'portal.sqlite'));
  fs.copyFileSync(path.join(directory,'vault.key'),path.join(destination,'vault.key'));
  const check=new DatabaseSync(path.join(destination,'portal.sqlite'),{readOnly:true});
  try {if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('La verificación falló.');}
  finally {check.close();}
  console.log(`Copia consistente de base y clave: ${destination}`);
} finally {db.close();}
