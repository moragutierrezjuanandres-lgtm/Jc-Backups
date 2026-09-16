import { randomBytes, randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { admin, backupsAllowed } from './access.js';
const require = createRequire(import.meta.url);
const archiver = require('archiver');
const terminal = new Set(['completed', 'failed', 'interrupted']);
const fail = (status, message) => Object.assign(new Error(message), { status });
export function validAgentIp(ip) {
  if (isIP(ip) !== 4) return false;
  const [a,b] = ip.split('.').map(Number);
  return a === 10 || a === 26 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (process.env.JC_TEST_MODE === '1' && a === 127);
}
export async function agentRequest(agent, method, route, payload) {
  const body = payload ? JSON.stringify(payload) : '';
  const timestamp = String(Date.now());
  const nonce = randomBytes(24).toString('hex');
  const sign = value => createHmac('sha256', agent.secret).update(value).digest('hex');
  const response = await fetch(`http://${agent.ip}:8091${route}`, {
    method, redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', 'X-JC-Time': timestamp, 'X-JC-Nonce': nonce, 'X-JC-Signature': sign(`${method}\n${route}\n${timestamp}\n${nonce}\n${body}`) },
    ...(body ? { body } : {})
  });
  const raw = await response.text();
  const signature = response.headers.get('x-jc-signature') || '';
  const expected = sign(`${nonce}\n${raw}`);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw fail(502, 'El agente no pudo autenticar su respuesta. Revise la instalación.');
  const data = JSON.parse(raw);
  if (!response.ok) throw fail(response.status, data.error || 'El agente rechazó la solicitud.');
  return data;
}
export function installBackups(app, store, agentDirectory) {
  const registry = id => store.sql.prepare('SELECT * FROM agents WHERE client_id=?').get(id);
  function enqueue(clientId, type = 'COMPLETO', requestedBy = 'Programador') {
    if (!['COMPLETO','INCREMENTAL','DIFERENCIAL'].includes(type)) throw fail(400, 'Tipo de respaldo no válido.');
    const agent = registry(clientId);
    if (!agent) throw fail(409, 'Primero prepare y conecte el agente del cliente.');
    const existing = store.jobs().find(j => j.clientId === clientId && !terminal.has(j.status));
    if (existing) return existing;
    const client = store.get('clients').find(c => c.id === clientId);
    const job = { id: randomUUID(), clientId, clientName: client?.commercialName || client?.businessName || clientId, ip: agent.ip, backupType: type, requestedBy, status: 'queued', progress: 0, message: 'Esperando conexión con el agente', createdAt: new Date().toISOString() };
    store.saveJob(job);
    store.audit(requestedBy, 'Solicitud de respaldo', `${job.clientName}: ${job.id}`);
    return job;
  }
  app.use('/api/backups', (req, res, next) => backupsAllowed(req.user) ? next() : res.status(403).json({ error: 'No tiene permiso para gestionar respaldos.' }));
  app.get('/api/backups', (req, res) => res.json({ jobs: store.jobs(), backups: store.jobs().filter(j => j.status === 'completed').map(j => ({ ...j, name: j.artifacts?.[0]?.name, clientFolder: j.clientName, modifiedAt: j.finishedAt, sizeMb: `${j.total_mb || 0} MB`, source: 'Agente verificado' })), agents: store.sql.prepare('SELECT client_id,ip,config FROM agents').all().map(a => ({ clientId: a.client_id, ip: a.ip, config: JSON.parse(a.config) })), schedules: store.sql.prepare('SELECT client_id,data FROM schedules').all().map(r => ({ clientId: r.client_id, ...JSON.parse(r.data) })) }));
  app.post('/api/backups/enroll', (req, res) => {
    if (!admin(req.user)) throw fail(403, 'Solo un administrador puede preparar agentes.');
    const { clientId, ip, sourceDirs, destinationPath, services = [], retentionCopies = 5 } = req.body;
    if (!validAgentIp(ip)) throw fail(400, 'Ingrese una IP privada o de Radmin VPN válida.');
    const client = store.get('clients').find(c => c.id === clientId);
    if (!client) throw fail(404, 'Cliente no encontrado.');
    if (!Array.isArray(sourceDirs) || !sourceDirs.length || sourceDirs.some(s => typeof s !== 'string' || !s.trim()) || typeof destinationPath !== 'string' || !destinationPath.trim()) throw fail(400, 'Defina al menos una carpeta de origen y un destino.');
    if (!Array.isArray(services) || services.some(s => !/^[a-zA-Z0-9_$ .-]{1,120}$/.test(s))) throw fail(400, 'Nombre de servicio no válido.');
    if (registry(clientId)) throw fail(409, 'El cliente ya tiene agente. Descargue nuevamente su instalador o cambie su IP.');
    if (store.sql.prepare('SELECT client_id FROM agents WHERE ip=?').get(ip)) throw fail(409, 'Esta IP ya pertenece a otro cliente.');
    const config = { client_name: client.commercialName || client.businessName, client_id: clientId, route_pairs: sourceDirs.map((source, i) => ({ id: i+1, source: source.trim(), destination: destinationPath.trim() })), pre_post_services: services, retencion_copias: Math.max(1, Math.min(100, Number(retentionCopies) || 5)), backup_type: 'COMPLETO' };
    store.sql.prepare('INSERT INTO agents VALUES (?,?,?,?)').run(clientId, ip, randomBytes(32).toString('hex'), JSON.stringify(config));
    store.audit(req.user.name, 'Preparación de agente', `${clientId}: ${ip}`);
    res.json({ success: true });
  });
  app.post('/api/backups/connect', async (req, res, next) => {
    try {
      const { clientId, ip } = req.body;
      if (!validAgentIp(ip)) throw fail(400, 'Ingrese una IP privada o de Radmin VPN válida.');
      const agent = registry(clientId);
      if (!agent) throw fail(409, 'Agente no preparado. Un administrador debe generar e instalar el paquete una sola vez.');
      const collision = store.sql.prepare('SELECT client_id FROM agents WHERE ip=?').get(ip);
      if (collision && collision.client_id !== clientId) throw fail(409, 'La IP está asociada a otro cliente.');
      const status = await agentRequest({ ...agent, ip }, 'GET', '/status');
      if (status.clientId !== clientId) throw fail(409, 'El equipo pertenece a otro cliente.');
      store.sql.prepare('UPDATE agents SET ip=? WHERE client_id=?').run(ip, clientId);
      res.json(status);
    } catch (e) { next(e.status ? e : fail(502, 'Agente no disponible. Compruebe que está instalado y que Radmin VPN permite el puerto 8091.')); }
  });
  app.get('/api/backups/package/:clientId', (req, res) => {
    if (!admin(req.user)) throw fail(403, 'Solo un administrador puede descargar el instalador.');
    const agent = registry(req.params.clientId);
    if (!agent) throw fail(404, 'Agente no preparado.');
    res.attachment('JC-Agente-Respaldos.zip');
    const archive = archiver('zip');
    archive.on('error', () => res.destroy());
    archive.pipe(res);
    for (const name of ['remote_agent.py','backup_agent.py','backup_engine.py','restore_backup.py','Instalar-Agente.ps1','INSTRUCCIONES-AGENTE.md']) archive.file(path.join(agentDirectory, name), { name });
    archive.append(JSON.stringify({ ...JSON.parse(agent.config), agent_secret: agent.secret }, null, 2), { name: 'config.json' });
    archive.finalize();
    store.audit(req.user.name, 'Descarga de agente', agent.client_id);
  });
  app.post('/api/backups/request', (req, res) => res.status(202).json({ success: true, job: enqueue(req.body.clientId, req.body.backupType || 'COMPLETO', req.user.name) }));
  app.post('/api/backups/schedule', (req, res) => {
    const { clientId, enabled, time, frequency, days = [], dayOfMonth = 1, backupType = 'COMPLETO' } = req.body;
    if (!registry(clientId)) throw fail(404, 'Prepare primero el agente.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time) || !['daily','weekly','monthly'].includes(frequency) || !['COMPLETO','INCREMENTAL','DIFERENCIAL'].includes(backupType) || !Array.isArray(days) || days.some(d => !Number.isInteger(d) || d < 0 || d > 6) || (frequency === 'weekly' && !days.length) || !Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 28) throw fail(400, 'Revise la hora y la frecuencia (día mensual: 1–28).');
    const data = { enabled: !!enabled, time, frequency, days, dayOfMonth, backupType, timezone: process.env.JC_TIMEZONE || 'America/Caracas' };
    store.sql.prepare('INSERT INTO schedules VALUES (?,?,NULL) ON CONFLICT(client_id) DO UPDATE SET data=excluded.data').run(clientId, JSON.stringify(data));
    store.audit(req.user.name, 'Programación de respaldo', clientId);
    res.json({ success: true });
  });
  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      for (const row of store.sql.prepare('SELECT * FROM schedules').all()) {
        const schedule = JSON.parse(row.data);
        if (!schedule.enabled) continue;
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: schedule.timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()).map(p => [p.type,p.value]));
        const date = `${parts.year}-${parts.month}-${parts.day}`;
        const day = new Date(`${date}T12:00:00Z`).getUTCDay();
        if (`${parts.hour}:${parts.minute}` < schedule.time || row.last_slot === date || (schedule.frequency === 'weekly' && !schedule.days.includes(day)) || (schedule.frequency === 'monthly' && Number(parts.day) !== schedule.dayOfMonth)) continue;
        store.transaction(() => { enqueue(row.client_id, schedule.backupType); store.sql.prepare('UPDATE schedules SET last_slot=? WHERE client_id=?').run(date, row.client_id); });
      }
      await Promise.allSettled(store.jobs().filter(j => !terminal.has(j.status)).map(async job => {
        const agent = registry(job.clientId);
        try {
          const state = await agentRequest(agent, 'POST', '/jobs', { id: job.id, backupType: job.backupType });
          // Only authenticated agent state can mark a job completed.
          const next = { ...job, ...state, id: job.id, clientId: job.clientId, lastContact: new Date().toISOString(), connectionError: null };
          store.saveJob(next);
          if (terminal.has(next.status)) store.audit('Agente', `Respaldo ${next.status}`, `${job.clientName}: ${next.message}`);
        } catch (e) { store.saveJob({ ...job, connectionError: 'Sin comunicación con el agente. El trabajo se consultará al reconectar.' }); }
      }));
    } finally { busy = false; }
  }
  const timer = setInterval(tick, 3000);
  timer.unref();
  return () => clearInterval(timer);
}
