import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

export default function Audit() {
  const { db } = useContext(AppContext);
  const [searchQuery, setSearchQuery] = useState('');

  if (!db) return null;

  // Filter logs by user, action, or details
  const filteredLogs = (db.auditLogs || []).filter(log => {
    if (!log) return false;
    const query = searchQuery.toLowerCase();
    const u = log.user ? String(log.user).toLowerCase() : '';
    const a = log.action ? String(log.action).toLowerCase() : '';
    const d = log.details ? String(log.details).toLowerCase() : '';
    const t = log.timestamp ? String(log.timestamp).toLowerCase() : '';
    return u.includes(query) || a.includes(query) || d.includes(query) || t.includes(query);
  });

  return (
    <div className="page-container">
      {/* View Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Monitoreo y Auditoría de Seguridad</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Historial de accesos a credenciales, inicios de sesión y operaciones registradas por el servidor.
        </p>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '16px' }}>
        <div className="form-group" style={{ maxWidth: '400px' }}>
          <label className="form-label">Filtrar logs por usuario, acción o fecha</label>
          <input
            type="text"
            placeholder="Buscar en el registro de auditoría..."
            className="form-input"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="card">
        <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
           Registro de Actividad Sensible ({filteredLogs.length} eventos registrados)
        </h3>

        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            No se encontraron logs que coincidan con la búsqueda.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha y Hora</th>
                  <th>Operador / Usuario</th>
                  <th>Acción Operativa</th>
                  <th>Detalle de Auditoría</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map(log => {
                  const isVaultAction = log.action === 'Bóveda de Credenciales';
                  return (
                    <tr key={log.id} style={{ 
                      backgroundColor: isVaultAction ? 'hsla(var(--danger-h), var(--danger-s), var(--danger-l), 0.02)' : 'inherit'
                    }}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {log.timestamp}
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {log.user}
                      </td>
                      <td>
                        <span className={`badge ${
                          isVaultAction ? 'badge-danger' : 
                          log.action === 'Cambio de Rol' ? 'badge-warning' : 
                          log.action === 'Inicio de Sesión' || log.action === 'Inicio de Sesión Rápido' ? 'badge-success' : 'badge-primary'
                        }`} style={{ fontSize: '0.65rem' }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ 
                        fontSize: '0.8125rem', 
                        color: isVaultAction ? 'var(--text)' : 'var(--text-muted)',
                        fontWeight: isVaultAction ? 550 : 'normal',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word'
                      }}>
                        {log.details}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
