import { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { PostgresStore } from '../lib/postgres.js';
import { importCollections } from '../lib/cloud-import.js';
import { readConfig } from './self-hosted.mjs';

export function readSnapshot(file) {
  const db=new DatabaseSync(file,{readOnly:true});
  try {
    if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw new Error('La copia SQLite no supera la verificación de integridad.');
    const collections=Object.fromEntries(db.prepare('SELECT name,data FROM collections').all().map(row=>[row.name,JSON.parse(row.data)]));
    const revision=db.prepare("SELECT value FROM meta WHERE key='revision'").get()?.value;
    if(!Number.isSafeInteger(revision)||revision<1)throw new Error('Revisión de origen inválida.');
    return {collections,revision};
  } finally {db.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  if(!process.argv[2])throw new Error('Indica la ruta de una copia SQLite verificada.');
  const config=readConfig();
  const snapshot=readSnapshot(process.argv[2]);
  const store=new PostgresStore(config.connectionString);
  try {
    const result=await importCollections(store,snapshot.collections,snapshot.revision);
    const revision=await store.transaction(false,state=>state.revision());
    if(revision!==snapshot.revision)throw new Error('La revisión importada no coincide.');
    console.log(JSON.stringify({...result,revision}));
  } finally {await store.close();}
}
