import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, randomUUID } from 'node:crypto';

export const passwordHash = password => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${scryptSync(password, salt, 64).toString('hex')}`;
};
export function passwordMatches(password, encoded) {
  try {
    const [type, salt, hash] = encoded.split(':');
    return type === 'scrypt' && timingSafeEqual(Buffer.from(hash, 'hex'), scryptSync(password, salt, 64));
  } catch { return false; }
}
export function publicEmployee(employee) {
  if (!employee) return null;
  const { password, passwordHash, ...safe } = employee;
  return safe;
}
export class Store {
  constructor(directory, legacyFile) {
    fs.mkdirSync(directory, { recursive: true });
    this.sql = new DatabaseSync(path.join(directory, 'portal.sqlite'));
    this.sql.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS collections (name TEXT PRIMARY KEY, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value INTEGER NOT NULL);
      INSERT OR IGNORE INTO meta VALUES ('revision', 1);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT, expires INTEGER);
      CREATE TABLE IF NOT EXISTS agents (client_id TEXT PRIMARY KEY, ip TEXT UNIQUE, secret TEXT, config TEXT);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, client_id TEXT, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS schedules (client_id TEXT PRIMARY KEY, data TEXT NOT NULL, last_slot TEXT);
    `);
    if (!this.sql.prepare('SELECT name FROM collections LIMIT 1').get()) {
      let initial = { employees: [], clients: [], tickets: [], projects: [], auditLogs: [] };
      if (legacyFile && fs.existsSync(legacyFile)) {
        initial = JSON.parse(fs.readFileSync(legacyFile, 'utf8'));
        // The original is never overwritten. Keep this migration snapshot outside the web root.
        fs.copyFileSync(legacyFile, path.join(directory, 'pre-migration.json'), fs.constants.COPYFILE_EXCL);
      } else if (process.env.JC_ADMIN_PASSWORD) {
        initial.employees.push({ id: 'emp-master', name: 'Administrador', email: process.env.JC_ADMIN_EMAIL || 'admin@jc.local', password: process.env.JC_ADMIN_PASSWORD, role: 'Administrador', status: 'Activo' });
      } else throw new Error('Se requiere database.json o JC_ADMIN_PASSWORD para inicializar el portal.');
      initial.employees = (initial.employees || []).map(e => {
        const safe = publicEmployee(e);
        return { ...safe, passwordHash: e.passwordHash || passwordHash(e.password || randomBytes(32).toString('hex')) };
      });
      this.transaction(() => Object.entries(initial).forEach(([key, data]) => this.put(key, data)));
    }
  }
  transaction(fn) {
    this.sql.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.sql.exec('COMMIT'); return result; }
    catch (e) { this.sql.exec('ROLLBACK'); throw e; }
  }
  read() { return Object.fromEntries(this.sql.prepare('SELECT * FROM collections').all().map(r => [r.name, JSON.parse(r.data)])); }
  get(key) { const row = this.sql.prepare('SELECT data FROM collections WHERE name=?').get(key); return row ? JSON.parse(row.data) : []; }
  put(key, data) { this.sql.prepare('INSERT OR REPLACE INTO collections VALUES (?,?)').run(key, JSON.stringify(data)); }
  revision() { return this.sql.prepare("SELECT value FROM meta WHERE key='revision'").get().value; }
  bump() { this.sql.exec("UPDATE meta SET value=value+1 WHERE key='revision'"); }
  audit(user, action, details) {
    this.put('auditLogs', [{ id: randomUUID(), timestamp: new Date().toISOString(), user, action, details }, ...this.get('auditLogs')].slice(0, 2000));
    this.bump();
  }
  jobs() { return this.sql.prepare('SELECT data FROM jobs ORDER BY rowid DESC LIMIT 500').all().map(r => JSON.parse(r.data)); }
  job(id) { const row = this.sql.prepare('SELECT data FROM jobs WHERE id=?').get(id); return row && JSON.parse(row.data); }
  saveJob(job) { this.sql.prepare('INSERT OR REPLACE INTO jobs VALUES (?,?,?)').run(job.id, job.clientId, JSON.stringify(job)); }
  close() { this.sql.close(); }
}
