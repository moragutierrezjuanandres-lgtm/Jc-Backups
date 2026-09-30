export const runLabels = { queued: 'En cola', running: 'En ejecución', retry_wait: 'Esperando reintento', verifying: 'Verificando copia', succeeded: 'Copia verificada', partial: 'Copia incompleta', failed: 'Falló el respaldo', interrupted: 'Interrumpido', cancelled: 'Cancelado' };
export function selectBackupState({ runs = [], alerts = [], devices = [], connection = 'connected', now = Date.now() }) {
  if (connection === 'error') return { emotion: 'alert', message: 'No puedo actualizar el portal. Reintentando la conexión…', progress: null };
  const active = runs.find(run => ['running', 'verifying', 'retry_wait', 'queued'].includes(run.status));
  const telemetry = active?.progress || active?.telemetry || {};
  const updated = telemetry.updatedAt || active?.telemetry_updated_at;
  const fresh = !!updated && now - Date.parse(updated) < 45000;
  const raw = telemetry.percent ?? telemetry.percentDone;
  const progress = fresh && typeof raw === 'number' && Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : null;
  if (active) return { emotion: active.status === 'retry_wait' ? 'alert' : 'working', message: active.status === 'verifying' ? 'La copia llegó. Estoy verificando su integridad.' : `${runLabels[active.status]}${fresh ? ' · progreso recibido del equipo' : ' · esperando información del equipo'}`, run: active, telemetry, fresh, progress };
  if (alerts.length || runs[0]?.status === 'failed' || runs[0]?.status === 'partial') return { emotion: 'alert', message: 'Hay un respaldo que necesita tu atención.', progress: null };
  if (runs[0]?.status === 'succeeded') return { emotion: 'success', message: 'La última copia fue verificada. Tus respaldos están disponibles.', progress: null };
  if (!devices.length) return { emotion: 'guiding', message: 'Selecciona un cliente y vincula su equipo para empezar.', progress: null };
  return { emotion: 'idle', message: 'Estoy lista. El próximo respaldo se ejecutará según su horario.', progress: null };
}
