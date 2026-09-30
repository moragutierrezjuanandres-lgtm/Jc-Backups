import * as THREE from 'three';
import { IsabellaCloud } from '../../../../src/components/isabella-cloud.js';
const host = document.getElementById('isabella-cloud');
if (host && THREE.WebGLRenderer) {
  try {
    const cloud = new IsabellaCloud(host);
    cloud.setEmotion(document.querySelector('[role="status"]') ? 'alert' : 'guiding');
    document.querySelectorAll('form').forEach(form => form.addEventListener('submit', () => cloud.setEmotion('working')));
    window.addEventListener('pagehide', () => cloud.dispose(), { once: true });
  } catch { host.textContent = '☁'; host.setAttribute('aria-label', 'Isabella: asistente de respaldos'); }
}
