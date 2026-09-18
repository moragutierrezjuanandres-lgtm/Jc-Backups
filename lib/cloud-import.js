import { createHash, timingSafeEqual } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export function authorizedImport(header,expected) {
  if(!expected||expected.length<64||typeof header!=='string')return false;
  const actual=header.startsWith('Bearer ')?header.slice(7):'';
  return timingSafeEqual(createHash('sha256').update(actual).digest(),createHash('sha256').update(expected).digest());
}
export async function importCollections(store,data,revision=1) {
  if(!data||Array.isArray(data)||typeof data!=='object'||Object.entries(data).some(([k,v])=>! /^[a-zA-Z][a-zA-Z0-9]{0,63}$/.test(k)||!Array.isArray(v)))throw Object.assign(new Error('Datos de importación inválidos.'),{status:400});
  if(!data.employees?.some(e=>e.role==='Administrador'&&e.status==='Activo'&&e.passwordHash?.startsWith('scrypt:'))||data.employees.some(e=>Object.hasOwn(e,'password')))throw Object.assign(new Error('Se requieren usuarios con contraseñas cifradas mediante hash.'),{status:400});
  await store.initialize();
  await store.transaction(true,async(state,client)=>{
    if(Object.keys(state.read()).length||(await client.query('SELECT id FROM jc_imports LIMIT 1')).rows.length)throw Object.assign(new Error('La base ya fue inicializada. No se sobrescribieron datos.'),{status:409});
    for(const [name,records]of Object.entries(data))state.put(name,records);
    state.version=Number.isSafeInteger(revision)&&revision>0?revision:1;
    await client.query('INSERT INTO jc_imports(id,summary) VALUES($1,$2::jsonb)',['sqlite-initial',JSON.stringify({clients:data.clients?.length,employees:data.employees.length,tickets:data.tickets?.length})]);
  });
  const copied=await store.transaction(false,state=>state.read());
  if(!isDeepStrictEqual(data,copied))throw new Error('La verificación de los datos importados falló.');
  return {imported:true,verified:true,clients:data.clients?.length,employees:data.employees.length,tickets:data.tickets?.length};
}
