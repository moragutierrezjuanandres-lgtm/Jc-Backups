import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute=promisify(execFile);
export async function retainVerified({pool,binary,path,password,deviceId,signal}) {
 const active=(await pool.query(`SELECT id FROM backup_runs WHERE device_id=$1 AND status IN ('running','verifying') LIMIT 1`,[deviceId])).rows[0];
 if(active)return;
 const policy=(await pool.query(`SELECT retention_successful_count FROM backup_policies WHERE device_id=$1 ORDER BY revision DESC LIMIT 1`,[deviceId])).rows[0];
 const keep=policy?.retention_successful_count;
 if(!Number.isInteger(keep)||keep<1)return;
 const stale=(await pool.query(`SELECT snapshot_id FROM backup_snapshots WHERE device_id=$1 AND retained=true ORDER BY verified_at DESC,id DESC OFFSET $2`,[deviceId,keep])).rows.map(row=>row.snapshot_id);
 if(!stale.length)return;
 if(stale.some(id=>!/^[a-f0-9]{64}$/.test(id)))throw new Error('invalid_snapshot');
 await execute(binary,['-r',path,'forget',...stale,'--prune'],{windowsHide:true,signal,timeout:12*3600000,maxBuffer:16*1024*1024,env:{...process.env,RESTIC_PASSWORD:password}});
 await pool.query('UPDATE backup_snapshots SET retained=false WHERE device_id=$1 AND snapshot_id=ANY($2::text[])',[deviceId,stale]);
}
