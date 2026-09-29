import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename, rm, stat } from 'node:fs/promises';
import { resolve, join, parse, basename } from 'node:path';
import { tmpdir } from 'node:os';
import bcrypt from 'bcryptjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function repositoryIdentity(clientId, deviceId) {
  if (typeof clientId !== 'string' || !clientId.trim() || clientId.length > 200 || /[\x00-\x1f\x7f/\\]/.test(clientId) || clientId === '.' || clientId === '..') throw new Error('invalid clientId');
  if (typeof deviceId !== 'string' || !UUID.test(deviceId)) throw new Error('invalid deviceId');
  return `${createHash('sha256').update(clientId).digest('hex')}_${deviceId.toLowerCase()}`;
}

export function repositoryPath(storageRoot, repositoryId) {
  if (!storageRoot || typeof storageRoot !== 'string') throw new Error('storageRoot is required');
  const parts = typeof repositoryId === 'string' ? repositoryId.split('_') : [];
  if (parts.length !== 2 || !UUID.test(parts[1]) || (!UUID.test(parts[0]) && !/^[a-f0-9]{64}$/i.test(parts[0]))) throw new Error('invalid repositoryId');
  const root = resolve(storageRoot);
  if (root.toLowerCase() === resolve(tmpdir()).toLowerCase()) throw new Error('temporary directory cannot be receiver storage');
  if (root === parse(root).root) throw new Error('volume root cannot be receiver storage');
  return join(root, repositoryId.toLowerCase());
}

function keyFor(vaultKey) {
  if (!vaultKey || (typeof vaultKey === 'string' && vaultKey.length < 32)) throw new Error('vaultKey must contain at least 32 bytes');
  return createHash('sha256').update(vaultKey).digest();
}

function seal(value, key, aad) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()]);
  return { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') };
}

function open(envelope, key, aad) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
  decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
  return JSON.parse(Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString());
}

async function atomicWrite(path, value) {
  const temporary = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.new`;
  try {
    await writeFile(temporary, value, { flag: 'wx', mode: 0o600 });
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

async function withLock(storageRoot, fn) {
  const lock = join(storageRoot, '.receiver-provision.lock');
  await mkdir(storageRoot, { recursive: true });
  for (let n = 0; n < 100; n++) {
    try {
      await mkdir(lock);
      try { return await fn(); } finally { await rm(lock, { recursive: true, force: true }); }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await new Promise(resolveWait => setTimeout(resolveWait, 100));
    }
  }
  throw new Error('receiver provisioning lock timed out');
}

async function updateHtpasswd(file, username, passwordHash) {
  let lines = [];
  try { lines = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const filtered = lines.filter(line => !line.startsWith(`${username}:`));
  if (passwordHash) filtered.push(`${username}:${passwordHash}`);
  await atomicWrite(file, `${filtered.join('\n')}\n`);
}

function runRestic(binary, args, password) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(binary, args, { windowsHide: true, env: { ...process.env, RESTIC_PASSWORD: password }, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString().slice(0, 4096); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolveRun() : reject(new Error(`restic init failed (${code}): ${stderr.replaceAll(password, '[redacted]').slice(0, 512)}`)));
  });
}

function publicResult(repositoryId, endpoint, secret) {
  return { repositoryId, endpoint, url: endpoint, username: repositoryId,
    password: secret.password, resticPassword: secret.resticPassword, key: secret.resticPassword };
}

export async function provisionRepository({ clientId, deviceId, storageRoot, resticBinary, restServerBaseUrl, vaultKey, credentialsFile }) {
  const repositoryId = repositoryIdentity(clientId, deviceId);
  const path = repositoryPath(storageRoot, repositoryId);
  if (!resticBinary) throw new Error('resticBinary is required');
  const base = new URL(restServerBaseUrl);
  if (base.protocol !== 'https:' || base.username || base.password || base.pathname !== '/') throw new Error('restServerBaseUrl must be an HTTPS origin');
  const endpoint = new URL(`${repositoryId}/`, base).toString();
  const key = keyFor(vaultKey);
  const root = resolve(storageRoot);
  const vaultDir = join(root, '.receiver-vault');
  const vaultFile = join(vaultDir, `${repositoryId}.json`);
  const htpasswdFile = credentialsFile ? resolve(credentialsFile) : join(root, '.htpasswd');
  if (htpasswdFile !== join(root, '.htpasswd')) throw new Error('credentialsFile must be storageRoot/.htpasswd');
  return withLock(root, async () => {
    await mkdir(vaultDir, { recursive: true });
    let envelope;
    try { envelope = JSON.parse(await readFile(vaultFile, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (envelope) {
      const secret = open(envelope, key, repositoryId);
      return publicResult(repositoryId, endpoint, secret);
    }
    try {
      await stat(join(path, 'config'));
      throw new Error('repository exists without encrypted receiver credentials');
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const secret = { password: randomBytes(32).toString('base64url'), resticPassword: randomBytes(32).toString('base64url') };
    await mkdir(path, { recursive: true });
    await runRestic(resticBinary, ['-r', path, 'init', '--repository-version', '2'], secret.resticPassword);
    const passwordHash = await bcrypt.hash(secret.password, 12);
    await atomicWrite(vaultFile, JSON.stringify(seal(secret, key, repositoryId)));
    await updateHtpasswd(htpasswdFile, repositoryId, passwordHash);
    return publicResult(repositoryId, endpoint, secret);
  });
}

export async function revokeRepository({ clientId, deviceId, repositoryId, storageRoot, credentialsFile }) {
  const id = repositoryId || repositoryIdentity(clientId, deviceId);
  repositoryPath(storageRoot, id);
  const root = resolve(storageRoot);
  const file = credentialsFile ? resolve(credentialsFile) : join(root, '.htpasswd');
  if (file !== join(root, '.htpasswd')) throw new Error('credentialsFile must be storageRoot/.htpasswd');
  await withLock(root, () => updateHtpasswd(file, id, null));
}
