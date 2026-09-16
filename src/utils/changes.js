const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const records = list => Array.isArray(list) && list.every(r => r && typeof r === 'object' && r.id != null);
export function changesBetween(before, after) {
  const result=[];
  for(const collection of Object.keys(after)) {
    if(['auditLogs','backups'].includes(collection) || same(before[collection],after[collection])) continue;
    const old=before[collection] || [], next=after[collection];
    if(records(old) && records(next)) {
      const a=new Map(old.map(r=>[r.id,r])),b=new Map(next.map(r=>[r.id,r]));
      for(const id of new Set([...a.keys(),...b.keys()])) if(!same(a.get(id),b.get(id))) result.push({collection,id,before:a.get(id)||null,after:b.get(id)||null});
    } else result.push({collection,id:null,before:old,after:next});
  }
  return result;
}
export function applyChanges(db,changes) {
  const result={...db};
  for(const {collection,id,before,after} of changes) {
    if(id==null) { result[collection]=after; continue; }
    const list=[...(result[collection]||[])],index=list.findIndex(r=>r.id===id);
    if(after===null) { if(index>=0)list.splice(index,1); }
    else if(index<0) list.push(after);
    else { const merged={...list[index]};for(const key of new Set([...Object.keys(before||{}),...Object.keys(after)])) if(!same(before?.[key],after[key])) {if(Object.hasOwn(after,key))merged[key]=after[key];else delete merged[key];}list[index]=merged; }
    result[collection]=list;
  }
  return result;
}
