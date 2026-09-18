import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { DatabaseSync, backup } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { projectRoot, defaultDataDirectory } from '../lib/paths.js';

const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const within = (parent, child) => { const r = path.relative(parent, child); return !r || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)); };
function fingerprint(db) {
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
  return createHash('sha256').update(JSON.stringify(tables.map(({name}) => [name, db.prepare(`SELECT * FROM "${name.replaceAll('"','""')}" ORDER BY rowid`).all()]))).digest('hex');
}
export async function migrateData({ root = projectRoot, destination = defaultDataDirectory(), port = 5000 } = {}) {
  destination = path.resolve(destination);
  if (within(root, destination) || within(destination, root)) throw new Error('El destino debe ser una carpeta independiente del repositorio.');
  if (port) {
    const running = await new Promise(resolve => {
      const socket = net.connect({host:'127.0.0.1', port});
      const done = value => { socket.destroy(); resolve(value); };
      socket.on('connect', () => done(true)); socket.on('error', () => done(false)); socket.setTimeout(2000, () => done(true));
    });
    if (running) throw new Error(`Detén el servidor del puerto ${port} antes de migrar.`);
  }
  const source = path.join(root, 'data');
  const sourceDb = path.join(source, 'portal.sqlite');
  if (!fs.existsSync(sourceDb)) throw new Error('No se encontró la base anterior; no se creará una base vacía.');
  if (!fs.existsSync(path.join(source, 'vault.key'))) throw new Error('Falta vault.key; conserva la clave original antes de migrar.');
  if (fs.existsSync(destination) && fs.readdirSync(destination).length) throw new Error('El destino contiene archivos. No se sobrescribieron los datos.');
  fs.mkdirSync(destination, {recursive:true, mode:0o700});
  const db = new DatabaseSync(sourceDb, {readOnly:true});
  let verification;
  try {
    verification = fingerprint(db);
    await backup(db, path.join(destination, 'portal.sqlite'));
    const copied = new DatabaseSync(path.join(destination, 'portal.sqlite'), {readOnly:true});
    try {
      if (copied.prepare('PRAGMA integrity_check').get().integrity_check !== 'ok' || fingerprint(copied) !== verification) throw new Error('La verificación de SQLite falló.');
    } finally { copied.close(); }
    for (const entry of fs.readdirSync(source)) {
      if (/^portal\.sqlite(?:-|$)/.test(entry) || entry.endsWith('.lck')) continue;
      fs.cpSync(path.join(source, entry), path.join(destination, entry), {recursive:true, errorOnExist:true, force:false});
    }
    if (hash(path.join(source,'vault.key')) !== hash(path.join(destination,'vault.key'))) throw new Error('La clave copiada no coincide.');
    if (fs.existsSync(path.join(root,'database.json'))) fs.copyFileSync(path.join(root,'database.json'),path.join(destination,'database.json'),fs.constants.COPYFILE_EXCL);
    const envFile = path.join(root,'.env');
    let env = fs.existsSync(envFile) ? fs.readFileSync(envFile,'utf8') : '';
    env = env.replace(/^\s*JC_DATA_DIR\s*=.*\r?\n?/gm, '');
    fs.writeFileSync(envFile, env.trimEnd() + '\nJC_DATA_DIR=' + JSON.stringify(destination.replaceAll('\\','/')) + '\n', {mode:0o600});
    fs.writeFileSync(path.join(destination,'migration.json'),JSON.stringify({date:new Date().toISOString(),source,verification},null,2));
    return {destination, verification};
  } finally { db.close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const envFile=path.join(projectRoot,'.env');
  if(fs.existsSync(envFile)) process.loadEnvFile(envFile);
  migrateData({destination:process.argv[2] || process.env.JC_DATA_DIR || defaultDataDirectory(),port:Number(process.env.PORT || 5000)})
    .then(({destination})=>console.log(`Migración verificada: ${destination}. Datos originales conservados; .env actualizado.`))
    .catch(error=>{console.error(error.message);process.exitCode=1;});
}
