import React, { useState, useEffect, useContext } from 'react';
import { AppContext, getApiUrl } from '../context/AppContext';
import Wiki from './Wiki';
import Utilitarios from './Utilitarios';
import ServiceReports from './ServiceReports';
import Backups from './Backups';

function BackupsCenterView() { return <Backups />; }

function ServersDirectoryView() {
  const { db } = useContext(AppContext);
  const [search, setSearch] = useState('');

  if (!db) return null;

  // Filter ONLY active clients (exclude status === 'Inactivo')
  const activeClients = (db.clients || []).filter(c => c.status !== 'Inactivo');

  const allServers = activeClients.flatMap(c => {
    const servers = (c.infrastructure && c.infrastructure.servers) || [];
    return servers.map(s => ({
      clientId: c.id,
      clientName: c.commercialName,
      contractType: c.contractType || 'Por Hora',
      name: s.name,
      ip: s.ip || 'N/A',
      type: s.type || 'Soporte',
      version: s.version || '1.0',
      anydesk: s.anydesk || 'N/A'
    }));
  });

  const filteredServers = allServers.filter(s =>
    !search ||
    s.clientName.toLowerCase().includes(search.toLowerCase()) ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.ip.toLowerCase().includes(search.toLowerCase()) ||
    s.anydesk.toLowerCase().includes(search.toLowerCase())
  );

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Screen view header */}
      <div className="card" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>
             Directorio de Servidores Activos e Infraestructura (a2 Softway)
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Listado exclusivo de servidores pertenecientes a clientes activos ({activeClients.length} empresas activas). Excluye clientes inactivos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            className="form-input"
            placeholder="🔍 Buscar por cliente, servidor o IP..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '260px', padding: '8px 12px', fontSize: '0.8125rem' }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrintPdf}
            style={{ padding: '8px 16px', fontWeight: 500 }}
          >
             Imprimir / PDF Servidores
          </button>
        </div>
      </div>

      {/* Screen Table */}
      <div className="card" style={{ padding: '20px' }}>
        <div className="table-wrapper">
          <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Cliente Activo</th>
                <th>Tipo Contrato</th>
                <th>Servidor / Equipo</th>
                <th>IP / Red VPN</th>
                <th>ID AnyDesk</th>
                <th>Tipo Servidor</th>
                <th>Versión a2</th>
              </tr>
            </thead>
            <tbody>
              {filteredServers.map((s, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{s.clientName}</td>
                  <td><span className="badge badge-primary">{s.contractType}</span></td>
                  <td><strong>{s.name}</strong></td>
                  <td><code>{s.ip}</code></td>
                  <td><strong style={{ color: 'var(--success)' }}>{s.anydesk}</strong></td>
                  <td>{s.type}</td>
                  <td><span className="badge badge-secondary">{s.version}</span></td>
                </tr>
              ))}
              {filteredServers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                    No se encontraron servidores de clientes activos.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable PDF Template Container */}
      <div className="print-report-container">
        <div className="print-header" style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16pt' }}>JC ENTERPRISE PORTAL - DIRECTORIO DE SERVIDORES ACTIVOS</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#555' }}>
            Fecha de emisión: {new Date().toLocaleDateString('es-ES')} | Clientes Activos Registrados: {activeClients.length}
          </p>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Cliente</th>
              <th>Contrato</th>
              <th>Servidor</th>
              <th>IP / VPN</th>
              <th>AnyDesk</th>
              <th>Tipo</th>
              <th>Versión a2</th>
            </tr>
          </thead>
          <tbody>
            {filteredServers.map((s, idx) => (
              <tr key={idx}>
                <td><strong>{s.clientName}</strong></td>
                <td>{s.contractType}</td>
                <td>{s.name}</td>
                <td>{s.ip}</td>
                <td>{s.anydesk}</td>
                <td>{s.type}</td>
                <td>{s.version}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// ==========================================
// 2. ESTADO MENSUAL DE TICKETS Y CLASIFICACIÓN CSAT (PDF)
// ==========================================
function MonthlyResolvedTicketsView() {
  const { db, currentUser, rateTicketCsat } = useContext(AppContext);
  const [selectedClientId, setSelectedClientId] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all'); // 'all', 'currentMonth', 'last30', 'custom'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  if (!db) return null;

  const isMasterUser = currentUser?.id === 'emp-master';
  const currentMonthYear = new Date().toISOString().substring(0, 7); // YYYY-MM
  const allTickets = db.tickets || [];

  // Filter tickets by custom date range, period & client
  const filteredTickets = allTickets.filter(t => {
    if (!t) return false;
    
    // Client filter
    const matchClient = selectedClientId === 'all' || t.clientId === selectedClientId;
    if (!matchClient) return false;

    const dateStr = (typeof t.closedAt === 'string' ? t.closedAt : (typeof t.resolvedAt === 'string' ? t.resolvedAt : (typeof t.createdAt === 'string' ? t.createdAt : ''))).substring(0, 10);

    // Custom Date Range filter
    if (startDate && dateStr && dateStr < startDate) return false;
    if (endDate && dateStr && dateStr > endDate) return false;

    // Period filter
    if (filterPeriod === 'all') return true;

    if (filterPeriod === 'currentMonth') {
      return dateStr.startsWith(currentMonthYear);
    }
    if (filterPeriod === 'last30') {
      if (!dateStr) return false;
      const isoStr = dateStr.includes('T') ? dateStr : dateStr.replace(' ', 'T');
      const ticketDate = new Date(isoStr);
      if (isNaN(ticketDate.getTime())) return false;
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return ticketDate >= thirtyDaysAgo;
    }
    return true;
  });

  const ratedTickets = filteredTickets.filter(t => typeof t.csatRating === 'number' && t.csatRating > 0);
  const avgCsat = ratedTickets.length > 0 ? (ratedTickets.reduce((sum, t) => sum + t.csatRating, 0) / ratedTickets.length).toFixed(1) : '5.0';
  const selectedClientObj = (db.clients || []).find(c => c.id === selectedClientId);

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Master Exclusive Chart embedded ONLY inside Estado Mensual */}
      {isMasterUser && <MasterClientRequestsChart />}

      {/* Header Card & Date Range Filters */}
      <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
               Estado Mensual de Solicitudes y Clasificación CSAT
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Informe oficial de gestión. Seleccione rango de fechas, cliente y califique la satisfacción para exportación en PDF.
            </p>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrintPdf}
            style={{ padding: '10px 20px', fontWeight: 500 }}
          >
             Exportar Estado Mensual (PDF)
          </button>
        </div>

        {/* Date Filters Controls Bar */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', backgroundColor: 'var(--background)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-muted)' }}>Período:</span>
            <select
              className="form-select"
              value={filterPeriod}
              onChange={e => setFilterPeriod(e.target.value)}
              style={{ width: '200px', padding: '6px 12px', fontSize: '0.8125rem' }}
            >
              <option value="all"> Todos los Registros</option>
              <option value="currentMonth"> Mes Actual ({currentMonthYear})</option>
              <option value="last30"> Últimos 30 Días</option>
            </select>
          </div>

          {/* Custom Date Range Selector (Fecha Desde -> Fecha Hasta) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--primary)' }}> Desde:</span>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={{ padding: '5px 10px', fontSize: '0.8125rem', width: '145px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--primary)' }}> Hasta:</span>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              style={{ padding: '5px 10px', fontSize: '0.8125rem', width: '145px' }}
            />
          </div>

          {(startDate || endDate) && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => { setStartDate(''); setEndDate(''); }}
              style={{ padding: '4px 10px', fontSize: '0.75rem' }}
            >
              ✕ Limpiar Fechas
            </button>
          )}

          {/* Client Filter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}>
            <input
              type="text"
              className="form-input"
              placeholder="🔍 Buscar cliente..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              style={{ width: '140px', padding: '5px 10px', fontSize: '0.8125rem' }}
            />

            <select
              className="form-select"
              value={selectedClientId}
              onChange={e => setSelectedClientId(e.target.value)}
              style={{ width: '180px', padding: '6px 12px', fontSize: '0.8125rem' }}
            >
              <option value="all"> Todos los Clientes</option>
              {(db.clients || [])
                .filter(c => c.commercialName.toLowerCase().includes(clientSearch.toLowerCase()))
                .map(c => (
                  <option key={c.id} value={c.id}>{c.commercialName}</option>
                ))
              }
            </select>
          </div>
        </div>
      </div>

      {/* Metrics Summary Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>TOTAL SOLICITUDES MOSTRADAS</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 500, color: 'var(--primary)', marginTop: '4px' }}>
            {filteredTickets.length} registros
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>SATISFACCIÓN PROMEDIO CSAT</span>
          <div style={{ fontSize: '1.8rem', fontWeight: 500, color: '#d97706', marginTop: '4px' }}>
            ⭐ {avgCsat} / 5.0
          </div>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{ratedTickets.length} encuestas registradas</span>
        </div>
      </div>

      {/* Screen Table */}
      <div className="card" style={{ padding: '20px' }}>
        <h4 style={{ margin: '0 0 14px 0', fontSize: '0.95rem', fontWeight: 600 }}>
          Detalle de Solicitudes y Carga de Satisfacción ({selectedClientId === 'all' ? 'Todos los Clientes' : selectedClientObj?.commercialName})
        </h4>
        <div className="table-wrapper">
          <table className="data-table" style={{ width: '100%', fontSize: '0.825rem' }}>
            <thead>
              <tr>
                <th>Código Ticket</th>
                <th>Cliente</th>
                <th>Día Solicitud</th>
                <th>Fecha Cierre</th>
                <th>Título / Falla</th>
                <th>Técnico</th>
                <th>Diagnóstico / Solución</th>
                <th style={{ minWidth: '150px' }}>Clasificación CSAT</th>
                <th style={{ minWidth: '220px' }}>Retroalimentación del Cliente</th>
              </tr>
            </thead>
            <tbody>
              {filteredTickets.map(t => (
                <tr key={t.id}>
                  <td><strong>{t.id}</strong></td>
                  <td style={{ color: 'var(--primary)', fontWeight: 500 }}>{t.clientName}</td>
                  <td><code>{t.createdAt ? t.createdAt.substring(0, 10) : 'N/A'}</code></td>
                  <td><code>{t.closedAt ? t.closedAt.substring(0, 10) : (t.resolvedAt ? t.resolvedAt.substring(0, 10) : 'Pendiente')}</code></td>
                  <td><strong>{t.title}</strong></td>
                  <td>{t.assigneeName || 'Soporte'}</td>
                  <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{t.solution || t.description}</td>
                  <td>
                    {/* Interactive CSAT Rating Buttons */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {[1, 2, 3, 4, 5].map(star => (
                        <button
                          key={star}
                          type="button"
                          className="btn"
                          onClick={() => rateTicketCsat(t.id, star, t.csatFeedback || '')}
                          style={{
                            padding: '2px 6px',
                            fontSize: '0.9rem',
                            backgroundColor: (t.csatRating || 0) >= star ? '#f59e0b' : 'var(--background)',
                            color: (t.csatRating || 0) >= star ? '#ffffff' : 'var(--text-muted)',
                            border: '1px solid var(--border)',
                            borderRadius: '3px',
                            cursor: 'pointer'
                          }}
                          title={`Clasificar con ${star} estrellas`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    {/* Editable Client Feedback Text */}
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Comentario / sugerencia del cliente..."
                      value={t.csatFeedback || ''}
                      onChange={e => rateTicketCsat(t.id, t.csatRating || 5, e.target.value)}
                      style={{ fontSize: '0.75rem', padding: '4px 8px', width: '100%' }}
                    />
                  </td>
                </tr>
              ))}
              {filteredTickets.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                    No se encontraron tickets registrados para el rango de fechas o filtro seleccionado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Printable PDF Template Container */}
      <div className="print-report-container">
        <div className="print-header" style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '16pt' }}>JC ENTERPRISE PORTAL - ESTADO MENSUAL DE SOLICITUDES Y SATISFACCIÓN</h2>
          <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#555' }}>
            Cliente: <strong>{selectedClientId === 'all' ? 'TODOS LOS CLIENTES' : selectedClientObj?.commercialName}</strong> | Rango: <strong>{startDate || 'Inicio'} al {endDate || 'Hoy'}</strong> | Fecha Impresión: {new Date().toLocaleDateString('es-ES')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px', fontSize: '10pt' }}>
          <div>Total Solicitudes: <strong>{filteredTickets.length}</strong></div>
          <div>Satisfacción Promedio CSAT: <strong>⭐ {avgCsat} / 5.0</strong></div>
        </div>

        <table className="print-table">
          <thead>
            <tr>
              <th>Ticket</th>
              <th>Cliente</th>
              <th>Día Solicitud</th>
              <th>Fecha Cierre</th>
              <th>Título / Incidencia</th>
              <th>Técnico</th>
              <th>Diagnóstico / Solución</th>
              <th>CSAT</th>
              <th>Retroalimentación del Cliente</th>
            </tr>
          </thead>
          <tbody>
            {filteredTickets.map(t => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{t.clientName}</td>
                <td>{t.createdAt ? t.createdAt.substring(0, 10) : 'N/A'}</td>
                <td>{t.closedAt ? t.closedAt.substring(0, 10) : 'En Proceso'}</td>
                <td>{t.title}</td>
                <td>{t.assigneeName || 'Soporte'}</td>
                <td>{t.solution || t.description}</td>
                <td>{t.csatRating ? `⭐ ${t.csatRating}/5` : '⭐ 5/5'}</td>
                <td>{t.csatFeedback || 'Sin observaciones'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

// ==========================================
// 3. GRÁFICA DE SOLICITUDES POR CLIENTE (SOLO MASTER)
// ==========================================
function MasterClientRequestsChart() {
  const { db, currentUser } = useContext(AppContext);

  if (!db) return null;

  const isMasterUser = currentUser?.id === 'emp-master';
  if (!isMasterUser) return null;

  const currentMonthYear = new Date().toISOString().substring(0, 7); // YYYY-MM

  // Tickets created this month
  const monthTickets = (db.tickets || []).filter(t => (typeof t.createdAt === 'string' ? t.createdAt : '').startsWith(currentMonthYear));

  // Count requests by client
  const clientRequests = {};
  monthTickets.forEach(t => {
    const cName = t.clientName || 'Sin Cliente';
    clientRequests[cName] = (clientRequests[cName] || 0) + 1;
  });

  const sortedClients = Object.entries(clientRequests).sort((a, b) => b[1] - a[1]);
  const maxRequests = Math.max(...Object.values(clientRequests), 1);

  return (
    <div className="card" style={{ padding: '24px', borderLeft: '4px solid var(--secondary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)' }}>
             Gráfica Estadística de Solicitudes de Clientes Hechas en el Mes
          </h3>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Consolidado de tickets de soporte generados este mes ({currentMonthYear}). Total: {monthTickets.length} solicitudes.
          </span>
        </div>
        <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
           Exclusivo Usuario Maestro (emp-master)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {sortedClients.map(([cName, count]) => {
          const widthPct = Math.round((count / maxRequests) * 100);
          return (
            <div key={cName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', fontWeight: 600 }}>
                <span style={{ color: 'var(--primary)' }}>🏢 {cName}</span>
                <span>{count} solicitudes ({Math.round((count / (monthTickets.length || 1)) * 100)}%)</span>
              </div>
              <div style={{ height: '12px', backgroundColor: 'var(--background)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)' }}>
                <div
                  style={{
                    width: `${widthPct}%`,
                    height: '100%',
                    background: 'var(--card-hover)',
                    borderRadius: '6px',
                    transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
                  }}
                />
              </div>
            </div>
          );
        })}
        {sortedClients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No se registraron solicitudes de soporte durante el mes en curso.
          </div>
        )}
      </div>
    </div>
  );
}

export default function JcView() {
  const [currentSubTab, setCurrentSubTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const sub = params.get('subtab');
      if (sub === 'backups' || sub === 'respaldos') return 'backups';
      if (sub === 'servers' || sub === 'servidores') return 'servers';
      if (sub === 'tickets' || sub === 'estado' || sub === 'reportes') return 'estadoMensual';
    } catch (e) {}
    return 'wiki';
  });

  return (
    <div className="page-container" style={{ padding: 0 }}>
      {/* Top Tabs Bar */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap',
        gap: '12px', 
        borderBottom: '1px solid var(--border)', 
        padding: '16px 16px 12px 16px',
        backgroundColor: 'var(--card)',
        alignItems: 'center'
      }}>
        <button 
          onClick={() => setCurrentSubTab('wiki')}
          style={{
            background: currentSubTab === 'wiki' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
            border: currentSubTab === 'wiki' ? '1px solid var(--warning)' : '1px solid transparent',
            color: currentSubTab === 'wiki' ? 'var(--warning)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          Wiki
        </button>
        <button 
          onClick={() => setCurrentSubTab('utilitarios')}
          style={{
            background: currentSubTab === 'utilitarios' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
            border: currentSubTab === 'utilitarios' ? '1px solid var(--warning)' : '1px solid transparent',
            color: currentSubTab === 'utilitarios' ? 'var(--warning)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          Utilitarios
        </button>
        <button 
          onClick={() => setCurrentSubTab('reports')}
          style={{
            background: currentSubTab === 'reports' ? 'rgba(245, 158, 11, 0.08)' : 'transparent',
            border: currentSubTab === 'reports' ? '1px solid var(--warning)' : '1px solid transparent',
            color: currentSubTab === 'reports' ? 'var(--warning)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
          Reporte de Servicio
        </button>

        <button 
          onClick={() => setCurrentSubTab('servers')}
          style={{
            background: currentSubTab === 'servers' ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
            border: currentSubTab === 'servers' ? '1px solid var(--primary)' : '1px solid transparent',
            color: currentSubTab === 'servers' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
           Servidores e Infraestructura
        </button>

        <button 
          onClick={() => setCurrentSubTab('estadoMensual')}
          style={{
            background: currentSubTab === 'estadoMensual' ? 'rgba(0, 230, 115, 0.12)' : 'transparent',
            border: currentSubTab === 'estadoMensual' ? '1px solid var(--success)' : '1px solid transparent',
            color: currentSubTab === 'estadoMensual' ? 'var(--success)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
           Estado Mensual
        </button>

        <button 
          onClick={() => setCurrentSubTab('backups')}
          style={{
            background: currentSubTab === 'backups' ? 'rgba(37, 99, 235, 0.12)' : 'transparent',
            border: currentSubTab === 'backups' ? '1px solid var(--primary)' : '1px solid transparent',
            color: currentSubTab === 'backups' ? 'var(--primary)' : 'var(--text-muted)',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            transition: 'all var(--transition-fast)'
          }}
        >
           Respaldos JC Backup
        </button>
      </div>

      {/* View Content */}
      <div style={{ animation: 'fadeInPage var(--transition-normal) forwards' }}>
        {currentSubTab === 'wiki' ? (
          <Wiki />
        ) : currentSubTab === 'utilitarios' ? (
          <Utilitarios />
        ) : currentSubTab === 'reports' ? (
          <ServiceReports />
        ) : currentSubTab === 'servers' ? (
          <ServersDirectoryView />
        ) : currentSubTab === 'estadoMensual' ? (
          <MonthlyResolvedTicketsView />
        ) : (
          <BackupsCenterView />
        )}
      </div>
    </div>
  );
}
