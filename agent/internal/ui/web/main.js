import * as THREE from 'three';
import { IsabellaCloud } from '../../../../src/components/isabella-cloud.js';
import { selectBackupState } from '../../../../src/components/backup-state.js';
const host = document.getElementById('isabella-cloud');
if (host && THREE.WebGLRenderer) {
  try {
    const cloud = new IsabellaCloud(host);
    const note=document.querySelector('[role="status"]');
    const message=note?.textContent||'';
    cloud.setEmotion(/No |rechaz/i.test(message)?'alert':/vinculado|guardada/i.test(message)?'success':'guiding');
    document.querySelectorAll('form').forEach(form => form.addEventListener('submit', () => cloud.setEmotion('working')));
    let timer;
    if(document.querySelector('a[href="/status"]')) {
      const label=document.createElement('p');label.setAttribute('role','status');host.after(label);
      const poll=async()=>{
        if(document.hidden)return;
        try {const response=await fetch('/telemetry');if(!response.ok)throw new Error('connection');const data=await response.json();const state=selectBackupState({...data,devices:[data.device]});cloud.setEmotion(state.emotion);label.textContent=state.message+(state.progress!==null?` · ${Math.round(state.progress)}%`:'');}
        catch {cloud.setEmotion('alert');label.textContent='No pude actualizar el estado. Revisa la conexión o inicia sesión nuevamente.';}
      };
      poll();timer=setInterval(poll,15000);
    }
    window.addEventListener('pagehide', () => {clearInterval(timer);cloud.dispose();}, { once: true });
  } catch { host.textContent = '☁'; host.setAttribute('aria-label', 'Isabella: asistente de respaldos'); }
}
