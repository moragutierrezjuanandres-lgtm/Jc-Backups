export function scopeBackups(data = {}, clientId, deviceId) {
  const match = item => (!clientId || item.clientId === clientId) && (!deviceId || item.deviceId === deviceId);
  return {
    devices: (data.devices || []).filter(match),
    runs: (data.runs || []).filter(match),
    alerts: (data.alerts || []).filter(match),
  };
}

export function deviceState(device = {}, now = Date.now()) {
  if (device.status === 'revoked') return 'Revocado';
  const seen = Date.parse(device.lastSeenAt || '');
  return Number.isFinite(seen) && now - seen <= 120000 ? 'Conectado' : 'Sin conexión';
}

export function makePolicy(input = {}) {
  const compression = input.compression === undefined ? 'auto' : input.compression;
  if (!['auto', 'max'].includes(compression)) throw new Error('La compresión debe ser automática o máxima.');
  const sourceDirs = String(input.sourceText || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (!sourceDirs.length) throw new Error('Indica al menos una carpeta.');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time || '')) throw new Error('La hora no es válida.');
  const days = Array.isArray(input.days) ? input.days : [];
  if (!days.length || days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Selecciona al menos un día válido.');
  return { enabled: Boolean(input.enabled), compression, sourceDirs, excludes: input.excludes || [], days, time: input.time, timezone: input.timezone || 'America/Caracas', retentionSuccessfulCount: Math.max(1, Math.min(365, Number(input.retentionSuccessfulCount || 7))), consistencyProfile: input.consistencyProfile || 'files' };
}
