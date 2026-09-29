import { randomBytes, randomInt, createHash, randomUUID, createCipheriv } from 'node:crypto';

const fail=(status,message)=>Object.assign(new Error(message),{status});
const hash=value=>createHash('sha256').update(value).digest('hex');
export const canManageBackups=user=>Boolean(user&&(user.role==='Administrador'||(user.role!=='Cliente'&&user.allowedSections?.includes('backups'))));
export const canReadClient=(user,clientId)=>Boolean(user&&(user.role==='Administrador'||(user.role==='Cliente'&&user.clientId===clientId)));

export class BackupAuth {
  constructor(pool,vaultKey,receiver){
    this.pool=pool; this.vaultKey=Buffer.isBuffer(vaultKey)?vaultKey:Buffer.from(vaultKey||''); this.receiver=receiver;
    if(this.vaultKey.length!==32) throw new Error('backup vault key must be 32 bytes');
  }
  async transaction(fn){const c=await this.pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}}
  async createEnrollment(clientId,createdBy,now=new Date()){
    const code=String(randomInt(100000,1000000));
    const expires=new Date(now.getTime()+600000);
    await this.pool.query('INSERT INTO backup_enrollments(id,client_id,code_hash,created_by,expires_at) VALUES($1,$2,$3,$4,$5)',[randomUUID(),clientId,hash(code),createdBy,expires]);
    return {code,clientId,expiresAt:expires.toISOString()};
  }
  async enroll(code,label,now=new Date(),user=null){
    if(typeof code!=='string'||!/^[0-9]{6}$/.test(code))throw fail(400,'Código no válido.');
    const token=randomBytes(32).toString('base64url');
    const row=await this.transaction(async c=>{
      const enrollment=(await c.query('SELECT * FROM backup_enrollments WHERE code_hash=$1 FOR UPDATE',[hash(code)])).rows[0];
      if(!enrollment||enrollment.used_at||new Date(enrollment.expires_at)<=now)throw fail(401,'Código vencido o ya utilizado.');
      if(!user||(!canManageBackups(user)&&!canReadClient(user,enrollment.client_id)))throw fail(403,'El usuario no tiene acceso al cliente de este código.');
      const result=await c.query(`UPDATE backup_enrollments SET used_at=$2 WHERE code_hash=$1 AND used_at IS NULL AND expires_at>$2 RETURNING *`,[hash(code),now]);
      if(!result.rows[0])throw fail(401,'Código vencido o ya utilizado.');
      const e=result.rows[0],deviceId=randomUUID();
      await c.query('INSERT INTO backup_devices(id,client_id,label,token_hash) VALUES($1,$2,$3,$4)',[deviceId,e.client_id,label||'Equipo',hash(token)]);
      return {deviceId,clientId:e.client_id};
    });
    let provision;
    try{provision=await this.receiver.provision({clientId:row.clientId,deviceId:row.deviceId});}
    catch(error){await this.pool.query('UPDATE backup_devices SET status=\'revoked\',revoked_at=now() WHERE id=$1',[row.deviceId]);throw error;}
    const secret={url:provision.url,username:provision.username,password:provision.password,key:provision.key};
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',this.vaultKey,iv);
    const data=Buffer.concat([cipher.update(JSON.stringify(secret),'utf8'),cipher.final()]);
    await this.pool.query('UPDATE backup_devices SET repository_id=$2,repository_secret=$3 WHERE id=$1',[row.deviceId,provision.repositoryId,JSON.stringify({iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')})]);
    return {...row,token,repositoryId:provision.repositoryId,repository:provision};
  }
  async authenticate(header){
    if(typeof header!=='string'||!/^Bearer [A-Za-z0-9_-]{43}$/.test(header))throw fail(401,'Equipo no autorizado.');
    const token=header.slice(7);
    const row=(await this.pool.query('SELECT * FROM backup_devices WHERE token_hash=$1 AND status=\'active\'',[hash(token)])).rows[0];
    if(!row)throw fail(401,'Equipo no autorizado.');
    await this.pool.query('UPDATE backup_devices SET last_seen_at=now() WHERE id=$1',[row.id]);
    return row;
  }
  async revoke(deviceId){
    const row=(await this.pool.query('SELECT * FROM backup_devices WHERE id=$1',[deviceId])).rows[0];
    if(!row)throw fail(404,'Equipo no encontrado.');
    await this.pool.query('UPDATE backup_devices SET status=\'revoked\',revoked_at=now() WHERE id=$1',[deviceId]);
    await this.receiver.revoke({deviceId,clientId:row.client_id,repositoryId:row.repository_id});
    return {success:true};
  }
}
