import React, { useEffect, useRef, useState } from 'react';
import { IsabellaCloud as Cloud, emotionLabels } from './isabella-cloud';
import './isabella.css';

export default function IsabellaCloud({ state = 'idle', message }) {
  const host = useRef(null);
  const cloud = useRef(null);
  const [available, setAvailable] = useState(true);
  useEffect(() => {
    try { cloud.current = new Cloud(host.current); }
    catch { setAvailable(false); }
    return () => { cloud.current?.dispose(); cloud.current = null; };
  }, []);
  useEffect(() => { cloud.current?.setEmotion(state); }, [state]);
  return <figure className="isabella-figure">
    <div ref={host} className="isabella-cloud" aria-hidden="true">{!available && <span className="isabella-cloud-fallback">☁</span>}</div>
    <figcaption><span className="isabella-eyebrow">TU ASISTENTE DE RESPALDOS</span><h2>Isabella</h2><p role="status">{message || emotionLabels[state] || emotionLabels.idle}</p>{!available && <small>Modo gráfico compatible. Los respaldos siguen disponibles.</small>}</figcaption>
  </figure>;
}
