import { isDeepStrictEqual as equal } from 'node:util';
import { canWrite } from './access.js';
import { publicEmployee, passwordHash } from './auth.js';
const error = (status,message) => Object.assign(new Error(message),{status});

// Both local SQLite and cloud PostgreSQL call this inside an atomic transaction.
export function applyRecordChanges(store,user,changes) {
    if(!Array.isArray(changes) || changes.length>1000) throw error(400,'Lista de cambios no válida.');
      for(const change of changes) {
        const {collection,id,before,after}=change;
        if(['auditLogs','backups'].includes(collection)) continue;
        if(!canWrite(user,collection)) throw error(403,`No tienes permiso para modificar ${collection}.`);
        const current=store.get(collection);
        if(!Array.isArray(current)) throw error(400,'Colección no válida.');
        if(id == null) {
          if(['employees','clients','projects','tickets','notifications'].includes(collection)) throw error(400,'Esta colección requiere cambios por registro.');
          if(!Array.isArray(after) || !equal(current,before)) throw error(409,'El registro cambió en otro equipo. Actualiza y vuelve a intentarlo.');
          store.put(collection,after);continue;
        }
        const index=current.findIndex(r=>r.id===id);
        const record=index<0?null:current[index];
        const safe=collection==='employees'?publicEmployee(record):record;
        if(user.role==='Cliente') {
          if(collection!=='tickets' || record || !after || after.clientId!==user.clientId) throw error(403,'Solo puedes crear tickets para tu cliente.');
          const safeFields=['id','title','description','clientId','clientName','photoUrl','imageUrl','createdAt','status','priority','category','history','station'];
          if(Object.keys(after).some(k=>!safeFields.includes(k))) throw error(403,'Campos de ticket no autorizados.');
          after.status='Abierto';after.assigneeId=null;
        }
        let merged;
        if(before===null) {
          if(record) throw error(409,'El registro ya existe.');
          merged=after;
        } else if(after===null) {
          if(!equal(safe,before)) throw error(409,'El registro cambió; no se eliminó.');
          if(collection==='employees' && id===user.id) throw error(400,'No puedes eliminar tu propia cuenta.');
          current.splice(index,1);store.put(collection,current);continue;
        } else {
          if(!record || !before || !after) throw error(409,'El registro ya no existe.');
          merged={...record};
          for(const field of new Set([...Object.keys(before),...Object.keys(after)])) {
            if(['__proto__','constructor','prototype','passwordHash'].includes(field)) throw error(400,'Campo no permitido.');
            if(equal(before[field],after[field])) continue;
            if(!equal(safe[field],before[field])) throw error(409,`Otro usuario modificó ${collection}.${field}. Actualiza e inténtalo de nuevo.`);
            if(Object.hasOwn(after,field)) merged[field]=after[field];else delete merged[field];
          }
        }
        if(!merged || typeof merged!=='object' || Array.isArray(merged) || merged.id!==id) throw error(400,'Registro inválido.');
        if(collection==='employees') {
          if(before===null && Object.hasOwn(merged,'passwordHash')) throw error(400,'No se aceptan hashes de contraseña.');
          if(merged.password) {if(typeof merged.password!=='string'||merged.password.length<10) throw error(400,'La nueva contraseña debe tener al menos 10 caracteres.');merged.passwordHash=passwordHash(merged.password);}
          if(!merged.passwordHash) throw error(400,'La cuenta requiere una contraseña.');
          delete merged.password;
          if(!['Administrador','Gerente','Supervisor','Técnico','Asistente','Cliente'].includes(merged.role)) throw error(400,'Rol no válido.');
        }
        if(index<0) current.push(merged);else current[index]=merged;
        store.put(collection,current);
      }
      if(!store.get('employees').some(e=>e.role==='Administrador'&&e.status==='Activo')) throw error(400,'Debe existir al menos un administrador activo.');
      store.audit(user.name,'Actualización',`${changes.filter(c=>!['auditLogs','backups'].includes(c.collection)).length} cambios guardados.`);
}
