import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { provisionRepository, revokeRepository } from '../server/backup-receiver/provision.mjs';

const root = await mkdtemp(join(tmpdir(), 'jc-receiver-test-'));
test.after(async () => { await rm(root, { recursive: true, force: true }); });

const clientId = randomUUID();
const deviceId = randomUUID();
const vaultKey = randomBytes(32);
const options = { clientId, deviceId, storageRoot: join(root, 'data'), vaultKey,
  restServerBaseUrl: 'https://backup.example.test', resticBinary: process.env.JC_TEST_RESTIC || 'restic' };

test('rejects path traversal and storage in TEMP', async () => {
  await assert.rejects(provisionRepository({ ...options, clientId: '../other' }), /invalid clientId/i);
  await assert.rejects(provisionRepository({ ...options, deviceId: 'other/device' }), /invalid deviceId/i);
  await assert.rejects(provisionRepository({ ...options, storageRoot: tmpdir() }), /temporary/i);
});

test('provisions unique encrypted credentials and returns same credentials on repeat', async (t) => {
  if (!process.env.JC_TEST_RESTIC) return t.skip('JC_TEST_RESTIC required for real repository init');
  const first = await provisionRepository(options);
  const second = await provisionRepository(options);
  assert.deepEqual(second, first);
  assert.equal(first.repositoryId, `${clientId}_${deviceId}`);
  assert.equal(first.endpoint, `https://backup.example.test/${first.username}/`);
  assert.ok(first.password.length >= 32);
  assert.ok(first.resticPassword.length >= 32);
  const other = await provisionRepository({ ...options, deviceId: randomUUID() });
  assert.notEqual(other.password, first.password);
  assert.notEqual(other.resticPassword, first.resticPassword);
  const bytes = await readFile(join(options.storageRoot, '.receiver-vault', `${first.repositoryId}.json`), 'utf8');
  assert.ok(!bytes.includes(first.password));
  assert.ok(!bytes.includes(first.resticPassword));
  const htpasswd = await readFile(join(options.storageRoot, '.htpasswd'), 'utf8');
  assert.match(htpasswd, new RegExp(`^${first.username}:\\$2[aby]\\$`, 'm'));
  assert.ok(!htpasswd.includes(first.password));
  await revokeRepository({ ...options, repositoryId: first.repositoryId });
  const after = await readFile(join(options.storageRoot, '.htpasswd'), 'utf8');
  assert.ok(!after.includes(`${first.username}:`));
});
