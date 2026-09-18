import pg from 'pg';
import { randomUUID } from 'node:crypto';

export const schema = `
CREATE TABLE IF NOT EXISTS jc_meta (id integer PRIMARY KEY CHECK (id=1), revision bigint NOT NULL);
INSERT INTO jc_meta VALUES (1,1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS jc_collections (name text PRIMARY KEY, data jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS jc_sessions (token text PRIMARY KEY, user_id text NOT NULL, expires bigint NOT NULL);
CREATE INDEX IF NOT EXISTS jc_sessions_expires ON jc_sessions(expires);
CREATE TABLE IF NOT EXISTS jc_login_attempts (key text PRIMARY KEY, count integer NOT NULL, expires bigint NOT NULL);
CREATE TABLE IF NOT EXISTS jc_imports (id text PRIMARY KEY, imported_at timestamptz NOT NULL DEFAULT now(), summary jsonb NOT NULL);
`;

export class CollectionState {
  constructor(rows, revision) {
    this.data = Object.fromEntries(rows.map(row=>[row.name,row.data]));
    this.version=Number(revision);this.changed=new Set();
  }
  get(name){return this.data[name] || [];}
  put(name,data){this.data[name]=data;this.changed.add(name);}
  read(){return this.data;}
  revision(){return this.version;}
  bump(){this.version++;}
  audit(user,action,details){this.put('auditLogs',[{id:randomUUID(),timestamp:new Date().toISOString(),user,action,details},...this.get('auditLogs')].slice(0,2000));this.bump();}
}

export class PostgresStore {
  constructor(connectionString, pool) {
    if(!pool && !connectionString)throw new Error('DATABASE_URL no está configurada.');
    this.pool=pool || new pg.Pool({connectionString,max:3,idleTimeoutMillis:10000,connectionTimeoutMillis:15000,allowExitOnIdle:true});
    this.pool.on('error',()=>console.error('Se interrumpió una conexión con PostgreSQL.'));
  }
  async initialize(){await this.pool.query(schema);}
  async transaction(write,callback) {
    const client=await this.pool.connect();
    try {
      await client.query(write?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
      await client.query("SET LOCAL statement_timeout = '20s'");
      // Serialize mutations across all Vercel instances; never rely on process memory.
      const meta=await client.query('SELECT revision FROM jc_meta WHERE id=1'+(write?' FOR UPDATE':''));
      if(!meta.rows.length)throw Object.assign(new Error('La base de datos necesita inicialización.'),{status:503});
      const rows=await client.query('SELECT name,data FROM jc_collections');
      const state=new CollectionState(rows.rows,meta.rows[0].revision);
      const result=await callback(state,client);
      if(write){
        for(const name of state.changed)await client.query('INSERT INTO jc_collections(name,data) VALUES($1,$2::jsonb) ON CONFLICT(name) DO UPDATE SET data=EXCLUDED.data',[name,JSON.stringify(state.get(name))]);
        if(state.version!==Number(meta.rows[0].revision))await client.query('UPDATE jc_meta SET revision=$1 WHERE id=1',[state.version]);
      }
      await client.query('COMMIT');return result;
    }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
    finally{client.release();}
  }
  async attempt(key) {
    const now=Date.now();
    const result=await this.pool.query(`INSERT INTO jc_login_attempts(key,count,expires) VALUES($1,1,$2)
      ON CONFLICT(key) DO UPDATE SET count=CASE WHEN jc_login_attempts.expires<$3 THEN 1 ELSE jc_login_attempts.count+1 END,
      expires=CASE WHEN jc_login_attempts.expires<$3 THEN $2 ELSE jc_login_attempts.expires END RETURNING count`,[key,now+900000,now]);
    return result.rows[0].count<=10;
  }
  async clearAttempt(key){await this.pool.query('DELETE FROM jc_login_attempts WHERE key=$1 OR expires<$2',[key,Date.now()]);}
  async close(){await this.pool.end();}
}
