import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfig, startServer } from '../server/self-hosted.mjs';
import { randomBytes } from 'node:crypto';

const env = { DATABASE_URL: 'postgresql://jc:test@127.0.0.1:5432/jc_portal', JC_VAULT_KEY: randomBytes(32).toString('base64'), JC_ALLOWED_ORIGINS: 'https://www.jcevnzl.space,https://jcevnzl.space', PORT: '0' };
test('self-hosted configuration requires private postgres and the original vault key', () => {
  assert.throws(() => readConfig({}), /DATABASE_URL/);
  assert.throws(() => readConfig({...env, DATABASE_URL:'postgresql://jc:test@public.example/jc'}), /local/);
  assert.throws(() => readConfig({...env, JC_VAULT_KEY:'bad'}), /32 bytes/);
  assert.throws(() => readConfig({...env, JC_ALLOWED_ORIGINS:'http://public.example'}), /HTTPS/);
  assert.throws(() => readConfig({...env,PORT:'NaN'}), /PORT/);
  assert.equal(readConfig(env).host, '127.0.0.1');
});
test('self-hosted server serves health, rejects unknown origins and closes cleanly', async () => {
  let closed = false;
  const store = {pool:{query:async sql => {assert.equal(sql,'SELECT 1');return {rows:[{}]};}},close:async()=>{closed=true;}};
  const running=await startServer(readConfig(env),store);
  try {
    const root=`http://127.0.0.1:${running.server.address().port}`;
    const response=await fetch(root+'/api/health');
    assert.equal(response.status,200);
    assert.equal((await response.json()).status,'ok');
    assert.equal((await fetch(root+'/api/auth/session')).status,401);
    const denied=await fetch(root+'/api/auth/login',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:'{}'});
    assert.equal(denied.status,403);
  } finally { await running.close(); }
  assert.equal(closed,true);
});
