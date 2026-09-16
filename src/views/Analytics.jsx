import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Analytics() {
  const { 
    db, 
    currentUser, 
    addA2Category, 
    deleteA2Category, 
    addA2Report, 
    updateA2Report, 
    deleteA2Report 
  } = useContext(AppContext);

  const [searchAnyDesk, setSearchAnyDesk] = useState('');
  const [searchWorkstations, setSearchWorkstations] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Subtabs management
  const [activeSubTab, setActiveSubTab] = useState('kpis'); // 'kpis' or 'gallery'

  // A2 Gallery filters & states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Modals visibility
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Category management form state
  const [newCatName, setNewCatName] = useState('');

  // Report creation/edition form state
  const [reportEditId, setReportEditId] = useState(null); // null = adding, otherwise id
  const [reportTitle, setReportTitle] = useState('');
  const [reportDesc, setReportDesc] = useState('');
  const [reportUtility, setReportUtility] = useState('');
  const [reportCatId, setReportCatId] = useState('');
  const [reportSql, setReportSql] = useState('');
  const [reportFiles, setReportFiles] = useState([]);

  // Preview modal state
  const [previewReport, setPreviewReport] = useState(null);

  if (!db || !currentUser) return null;

  // --- Toast Notification helper ---
  const triggerToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 2000);
  };

  // --- Calculations for existing KPIs ---
  const clients = db.clients || [];
  const tickets = db.tickets || [];

  // --- Safe Date Parser helper ---
  const safeParseDate = (dateVal) => {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'string') {
      const str = dateVal.includes('T') ? dateVal : dateVal.replace(' ', 'T');
      const d = new Date(str);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(dateVal);
    return isNaN(d.getTime()) ? null : d;
  };

  // --- Dynamic Automatic Productivity Calculations for Tickets ---
  const resolvedTickets = tickets.filter(t => t && (t.status === 'Cerrado' || t.status === 'Resuelto'));
  
  // 1. MTTR (Tiempo Medio de Resolución)
  let totalMttrMs = 0;
  let validMttrCount = 0;
  resolvedTickets.forEach(t => {
    if (!t || !t.createdAt) return;
    const start = safeParseDate(t.createdAt);
    const end = safeParseDate(t.closedAt) || safeParseDate(t.resolvedAt) || new Date();
    if (!start || !end) return;
    let durationMs = end.getTime() - start.getTime();
    if (t.slaPausedMs) {
      durationMs -= t.slaPausedMs;
    }
    if (durationMs > 0) {
      totalMttrMs += durationMs;
      validMttrCount++;
    }
  });

  const avgMttrMinutes = validMttrCount > 0 ? Math.round(totalMttrMs / (validMttrCount * 1000 * 60)) : 0;
  const mttrHoursLabel = avgMttrMinutes < 60 ? `${avgMttrMinutes} min` : `${(avgMttrMinutes / 60).toFixed(1)} hrs`;

  // 2. FCR % (Tasa de Resolución en Primer Contacto)
  const fcrTickets = resolvedTickets.filter(t => {
    const isNoReopen = (t.reopenCount || 0) === 0;
    const isSingleInteraction = (t.history || []).length <= 3;
    return isNoReopen && isSingleInteraction;
  });
  const fcrPercent = resolvedTickets.length > 0 ? ((fcrTickets.length / resolvedTickets.length) * 100).toFixed(1) : '100.0';

  // 3. Tasa de Reapertura %
  const reopenedTickets = tickets.filter(t => t && ((t.reopenCount || 0) > 0 || t.status === 'Reabierto'));
  const totalClosedCount = tickets.filter(t => t && (t.status === 'Cerrado' || t.status === 'Resuelto')).length;
  const reopenPercent = totalClosedCount > 0 ? ((reopenedTickets.length / totalClosedCount) * 100).toFixed(1) : '0.0';

  // 4. Índice de Cumplimiento de SLA %
  const getSlaLimitMinutes = (priority) => {
    if (priority === 'Urgente' || priority === 'Alta') return 120; // 2 hrs max
    if (priority === 'Media') return 480; // 8 hrs max
    return 1440; // 24 hrs max
  };

  let slaCompliantCount = 0;
  let slaTotalProcessed = 0;

  tickets.forEach(t => {
    if (!t || (t.status !== 'Cerrado' && t.status !== 'Resuelto')) return;
    const limitMin = getSlaLimitMinutes(t.priority);
    const start = safeParseDate(t.createdAt);
    const end = safeParseDate(t.closedAt) || safeParseDate(t.resolvedAt) || new Date();
    if (!start || !end) return;
    let durationMin = (end.getTime() - start.getTime()) / (1000 * 60);
    if (t.slaPausedMs) {
      durationMin -= (t.slaPausedMs / (1000 * 60));
    }
    slaTotalProcessed++;
    if (durationMin <= limitMin) {
      slaCompliantCount++;
    }
  });

  const slaPercent = slaTotalProcessed > 0 ? ((slaCompliantCount / slaTotalProcessed) * 100).toFixed(1) : '100.0';

  // 5. CSAT Rating Promedio
  const ratedTickets = tickets.filter(t => t && typeof t.csatRating === 'number' && t.csatRating > 0);
  const avgCsat = ratedTickets.length > 0 ? (ratedTickets.reduce((sum, t) => sum + t.csatRating, 0) / ratedTickets.length).toFixed(1) : '5.0';

  const calculateEmployeeResponseTime = (employeeId, ticketsList) => {
    const empTickets = (ticketsList || []).filter(t => t && t.assigneeId === employeeId);
    let totalMs = 0;
    let count = 0;
    
    empTickets.forEach(t => {
      if (!t || !t.createdAt || !t.history || !Array.isArray(t.history) || t.history.length <= 1) return;
      const tCreated = safeParseDate(t.createdAt);
      if (!tCreated) return;

      const responseEvent = t.history.slice(1).find(h => 
        h && h.action && (
          h.action.includes('Estado cambiado') || 
          h.action.includes('reasignado') ||
          h.user !== 'Cliente'
        )
      );
      
      if (responseEvent && responseEvent.date) {
        const tResponded = safeParseDate(responseEvent.date);
        if (tResponded) {
          const diff = tResponded.getTime() - tCreated.getTime();
          if (diff > 0) {
            totalMs += diff;
            count++;
          }
        }
      }
    });
    
    if (count === 0) return { label: 'Sin datos', value: 999999 };
    const avgMinutes = Math.round(totalMs / (1000 * 60));
    if (avgMinutes < 60) {
      return { label: `${avgMinutes} min`, value: avgMinutes };
    }
    const avgHours = (avgMinutes / 60).toFixed(1);
    return { label: `${avgHours} hrs`, value: avgMinutes };
  };

  const sqlCount = clients.filter(c => c.dbType === 'SQL').length;
  const dbfCount = clients.filter(c => c.dbType === 'DBF' || !c.dbType).length;
  const totalClients = clients.length || 1;
  const sqlPercent = Math.round((sqlCount / totalClients) * 100);
  const dbfPercent = Math.round((dbfCount / totalClients) * 100);

  const clientHours = {};
  tickets.forEach(t => {
    const hours = t.hours || 2;
    clientHours[t.clientId] = (clientHours[t.clientId] || 0) + hours;
  });

  const slaWarnings = clients.map(c => ({
    id: c.id,
    name: c.commercialName,
    hours: clientHours[c.id] || 0
  })).filter(c => c.hours > 10);

  const fiscalPrinters = {
    Bixolon: 0,
    HKA: 0,
    Custom: 0,
    'The Factory': 0,
    Otros: 0
  };
  tickets.forEach(t => {
    const desc = (t.description || '').toLowerCase() + ' ' + (t.title || '').toLowerCase();
    if (desc.includes('bixolon')) {
      fiscalPrinters.Bixolon++;
    } else if (desc.includes('hka')) {
      fiscalPrinters.HKA++;
    } else if (desc.includes('custom')) {
      fiscalPrinters.Custom++;
    } else if (desc.includes('the factory') || desc.includes('tfh') || desc.includes('factory')) {
      fiscalPrinters['The Factory']++;
    } else if (desc.includes('fiscal') || desc.includes('impresora')) {
      fiscalPrinters.Otros++;
    }
  });
  const maxFiscalCount = Math.max(...Object.values(fiscalPrinters), 1);

  const pathologies = {
    'Errores de Rango': 0,
    'Corrupción DBF': 0,
    'Falla Fiscal': 0,
    'Red / Conectividad': 0
  };
  tickets.forEach(t => {
    const desc = (t.description || '').toLowerCase() + ' ' + (t.title || '').toLowerCase();
    if (desc.includes('rango') || desc.includes('indice') || desc.includes('index')) {
      pathologies['Errores de Rango']++;
    }
    if (desc.includes('tabla') || desc.includes('corrupt') || desc.includes('dbf') || desc.includes('cdx')) {
      pathologies['Corrupción DBF']++;
    }
    if (desc.includes('fiscal') || desc.includes('impresora') || desc.includes('papel') || desc.includes('error 40')) {
      pathologies['Falla Fiscal']++;
    }
    if (desc.includes('red') || desc.includes('conexion') || desc.includes('vpn') || desc.includes('servidor') || desc.includes('anydesk')) {
      pathologies['Red / Conectividad']++;
    }
  });
  const totalPathologies = Object.values(pathologies).reduce((a, b) => a + b, 0) || 1;

  const activeClientsOnly = clients.filter(c => c.status !== 'Inactivo');

  const allServers = activeClientsOnly.flatMap(c => {
    const servers = (c.infrastructure && c.infrastructure.servers) || [];
    return servers.map(s => ({
      clientName: c.commercialName,
      clientId: c.id,
      name: s.name,
      ip: s.ip,
      type: s.type || 'Soporte',
      version: s.version || '1.0',
      anydesk: s.anydesk || ''
    }));
  });

  const filteredServers = allServers.filter(s => {
    const term = searchAnyDesk.toLowerCase();
    return s.clientName.toLowerCase().includes(term) ||
           s.name.toLowerCase().includes(term) ||
           s.anydesk.toLowerCase().includes(term) ||
           s.ip.toLowerCase().includes(term);
  });

  const handleExportAnyDesk = () => {
    const text = allServers.map(s => `${s.clientName} | ${s.name} | AnyDesk: ${s.anydesk || 'N/A'} | IP: ${s.ip}`).join('\n');
    navigator.clipboard.writeText(text);
    triggerToast('¡Directorio AnyDesk copiado en CSV/Texto!');
  };

  const allWorkstations = activeClientsOnly.flatMap(c => {
    const workstations = (c.infrastructure && c.infrastructure.workstations) || [];
    return workstations.map(w => ({
      clientName: c.commercialName,
      clientId: c.id,
      id: w.id,
      name: w.name,
      username: w.username,
      password: w.password || '',
      anydesk: w.anydesk || '',
      anydeskPassword: w.anydeskPassword || '',
      fiscalPrinter: w.fiscalPrinter || '',
      details: w.details || ''
    }));
  });

  const filteredWorkstations = allWorkstations.filter(w => {
    const term = searchWorkstations.toLowerCase();
    return w.clientName.toLowerCase().includes(term) ||
           w.name.toLowerCase().includes(term) ||
           (w.username || '').toLowerCase().includes(term) ||
           (w.fiscalPrinter || '').toLowerCase().includes(term) ||
           (w.details || '').toLowerCase().includes(term) ||
           w.anydesk.toLowerCase().includes(term);
  });

  const handleExportWorkstations = () => {
    if (allWorkstations.length === 0) {
      triggerToast('No hay puestos de trabajo registrados.');
      return;
    }
    const header = "Cliente,Puesto de Trabajo,Usuario OS,ID AnyDesk,Impresora Fiscal,Detalles\r\n";
    const rows = allWorkstations.map(w => 
      `"${w.clientName}","${w.name}","${w.username || ''}","${w.anydesk}","${w.fiscalPrinter}","${w.details.replace(/"/g, '""')}"`
    ).join('\r\n');
    const blob = new Blob(["\ufeff" + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_puestos_trabajo_${Date.now()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Reporte CSV descargado con éxito');
  };

  const copyToClipboard = (text, message) => {
    navigator.clipboard.writeText(text);
    triggerToast(message || 'Copiado al portapapeles');
  };

  // --- Dynamic a2 reports filters ---
  const filteredReports = (db.a2Reports || []).filter(rep => {
    const matchCat = selectedCategory === 'all' || rep.categoryId === selectedCategory;
    const term = searchQuery.toLowerCase();
    const matchQuery = 
      rep.title.toLowerCase().includes(term) ||
      rep.description.toLowerCase().includes(term) ||
      (rep.utility || '').toLowerCase().includes(term) ||
      rep.sqlQuery.toLowerCase().includes(term);
    return matchCat && matchQuery;
  });

  // --- File Upload Handler inside Report Form ---
  const handleReportFileChange = (e) => {
    const filesArray = Array.from(e.target.files);
    filesArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const newFileObj = {
          id: `f-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          name: file.name,
          size: `${Math.round(file.size / 1024)} KB`,
          dataUrl: event.target.result
        };
        setReportFiles(prev => [...prev, newFileObj]);
      };
      reader.readAsDataURL(file);
    });
  };

  // --- Form submission handlers ---
  const handleCategorySubmit = (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    addA2Category(newCatName.trim());
    setNewCatName('');
    triggerToast('Categoría creada exitosamente ✓');
  };

  const handleReportSubmit = (e) => {
    e.preventDefault();
    if (!reportTitle || !reportDesc || !reportUtility || !reportSql) return;

    const reportData = {
      title: reportTitle,
      description: reportDesc,
      utility: reportUtility,
      categoryId: reportCatId || db.a2Categories?.[0]?.id || '',
      sqlQuery: reportSql,
      files: reportFiles
    };

    if (reportEditId) {
      updateA2Report(reportEditId, reportData);
      triggerToast('Reporte modificado exitosamente ✓');
    } else {
      addA2Report(reportData);
      triggerToast('Reporte agregado exitosamente ✓');
    }
    setShowReportModal(false);
  };

  // --- Simulated Mock Data Generator ---
  const getMockReportData = (reportId) => {
    switch (reportId) {
      case 'rep-1': // Libro de Ventas Fiscal (IVA)
        return {
          headers: ["Fecha", "Factura", "RIF", "Cliente", "Monto Exento", "Base Imponible", "Impuesto (16%)", "Total"],
          rows: [
            ["2026-06-01", "000124", "J-31415926", "Distribuidora El Sol, C.A.", "0.00", "1,250.00", "200.00", "1,450.00"],
            ["2026-06-02", "000125", "V-12345678", "Juan Pérez", "150.00", "0.00", "0.00", "150.00"],
            ["2026-06-05", "000126", "G-20004561", "Alcaldía de Caracas", "0.00", "4,800.00", "768.00", "5,568.00"],
            ["2026-06-10", "000127", "J-00129481", "Farmacia San José, F.P.", "220.00", "1,100.00", "176.00", "1,496.00"]
          ]
        };
      case 'rep-2': // Existencia Valorada de Inventario
        return {
          headers: ["Código", "Descripción", "Existencia", "Costo Promedio", "Costo Último", "Total Valorado"],
          rows: [
            ["INV-001", "SOPORTE DE PARED PARA TV 32-55", "45", "18.50", "19.00", "832.50"],
            ["INV-005", "CABLE HDMI DE ALTA VELOCIDAD 3M", "120", "2.10", "2.20", "252.00"],
            ["INV-012", "ROUTER INALÁMBRICO AC1200", "18", "34.00", "35.50", "612.00"],
            ["INV-025", "MEMORIA USB 64GB KINGSTON", "64", "6.80", "7.00", "435.20"]
          ]
        };
      case 'rep-3': // Ventas por Vendedor con Comisión
        return {
          headers: ["Vendedor", "Total Facturado", "Cobros Efectuados", "% Comisión", "Comisión a Pagar"],
          rows: [
            ["Carlos Mendoza (V-01)", "12,450.00", "11,200.00", "3%", "336.00"],
            ["María Valentina (V-02)", "8,900.00", "8,900.00", "3%", "267.00"],
            ["Javier Colmenares (V-03)", "16,800.00", "14,000.00", "4%", "560.00"],
            ["Gabriela Rivas (V-04)", "5,600.00", "4,800.00", "3%", "144.00"]
          ]
        };
      default: // Custom or user created reports mock data
        return {
          headers: ["Fecha Operación", "Registro Código", "Descripción Simulación", "Valor Neto (Ref.)"],
          rows: [
            [new Date().toISOString().split('T')[0], "MOCK-001", "Registro del Sistema de Prueba a2", "450.00"],
            [new Date().toISOString().split('T')[0], "MOCK-002", "Operación de Facturación Fiscal", "180.00"],
            [new Date().toISOString().split('T')[0], "MOCK-003", "Ajuste de Depósito e Inventario", "1,200.00"]
          ]
        };
    }
  };

  // SQL queries codes
  const sqlQuery1 = `SELECT 
    c.FI_CODIGO AS Codigo,
    c.FI_DESCRIPCION AS Cliente,
    COUNT(t.id_ticket) AS Total_Fallas,
    SUM(t.horas_invertidas) AS Horas_Soporte
FROM a2_db.dbo.SCLIENTES c
INNER JOIN jc_portal.dbo.PORTAL_TICKETS t ON c.FI_CODIGO = t.cod_cliente
WHERE t.fecha_registro >= DATEADD(month, -1, GETDATE())
GROUP BY c.FI_CODIGO, c.FI_DESCRIPCION
ORDER BY Total_Fallas DESC;`;

  const sqlQuery2 = `SELECT 
    CASE 
        WHEN t.descripcion LIKE '%rango%' THEN 'Error de Rango / Índices'
        WHEN t.descripcion LIKE '%tabla%' OR t.descripcion LIKE '%corrup%' THEN 'Corrupción de Tablas DBF'
        WHEN t.descripcion LIKE '%impresora%' OR t.descripcion LIKE '%fiscal%' THEN 'Falla de Impresora Fiscal'
        ELSE 'Otros Soporte Operativos'
    END AS Patologia,
    COUNT(*) AS Cantidad,
    AVG(t.horas_invertidas) AS Promedio_Horas_Resolucion
FROM jc_portal.dbo.PORTAL_TICKETS t
GROUP BY 
    CASE 
        WHEN t.descripcion LIKE '%rango%' THEN 'Error de Rango / Índices'
        WHEN t.descripcion LIKE '%tabla%' OR t.descripcion LIKE '%corrup%' THEN 'Corrupción de Tablas DBF'
        WHEN t.descripcion LIKE '%impresora%' OR t.descripcion LIKE '%fiscal%' THEN 'Falla de Impresora Fiscal'
        ELSE 'Otros Soporte Operativos'
    END
ORDER BY Cantidad DESC;`;

  return (
    <div className="page-container" style={{ position: 'relative' }}>
      
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          backgroundColor: 'var(--success)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: 'var(--radius-sm)',
          zIndex: 9999,
          fontWeight: 500,
          boxShadow: 'none',
          animation: 'fadeInPage 0.2s ease'
        }}>
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Reportes e Indicadores de Gestión</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Cuadro de mando, analíticas y galería dinámica de consultas SQL y reportes para sistemas a2 Softway.
        </p>
      </div>

      {/* Subtab Navigation Selector */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '24px', overflowX: 'auto' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('kpis')}
          className={`btn ${activeSubTab === 'kpis' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
        >
           Métricas y KPIs
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('gallery')}
          className={`btn ${activeSubTab === 'gallery' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '8px 16px', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}
        >
           Galería de Reportes a2
        </button>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* TAB 1: METRICS & KPIS                         */}
      {/* ───────────────────────────────────────────── */}
      {activeSubTab === 'kpis' && (
        <>
          {/* 🤖 Motor de Métricas Automáticas de Productividad de Tickets */}
          <div className="card" style={{ padding: '20px', marginBottom: '24px', borderLeft: '4px solid var(--primary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                   Motor de Métricas Automáticas de Productividad (Tickets)
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cálculo automatizado basado en marcas de tiempo (timestamps) y estado del ciclo de vida</span>
              </div>
              <span className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                Auto-Pause SLA & Auto-Close 48h Activos
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
              {/* MTTR */}
              <div style={{ padding: '14px', backgroundColor: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 500, textTransform: 'uppercase' }}>
                  MTTR (Tiempo Medio Resolución)
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--primary)', marginTop: '4px' }}>
                  {mttrHoursLabel}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Basado en {resolvedTickets.length} tickets resueltos
                </div>
              </div>

              {/* FCR % */}
              <div style={{ padding: '14px', backgroundColor: 'rgba(0, 230, 115, 0.08)', border: '1px solid rgba(0, 230, 115, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--success)', fontWeight: 500, textTransform: 'uppercase' }}>
                  FCR % (Primer Contacto)
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--success)', marginTop: '4px' }}>
                  {fcrPercent}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {fcrTickets.length} resueltos a la primera
                </div>
              </div>

              {/* Tasa Reapertura % */}
              <div style={{ padding: '14px', backgroundColor: 'rgba(255, 77, 77, 0.08)', border: '1px solid rgba(255, 77, 77, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--danger)', fontWeight: 500, textTransform: 'uppercase' }}>
                  Tasa de Reapertura %
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 500, color: 'var(--danger)', marginTop: '4px' }}>
                  {reopenPercent}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {reopenedTickets.length} tickets reabiertos
                </div>
              </div>

              {/* Cumplimiento SLA % */}
              <div style={{ padding: '14px', backgroundColor: 'rgba(139, 92, 246, 0.08)', border: '1px solid rgba(139, 92, 246, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: '#8b5cf6', fontWeight: 500, textTransform: 'uppercase' }}>
                  Cumplimiento SLA %
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 500, color: '#8b5cf6', marginTop: '4px' }}>
                  {slaPercent}%
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {slaCompliantCount} / {slaTotalProcessed} dentro de tiempo
                </div>
              </div>

              {/* CSAT Rating */}
              <div style={{ padding: '14px', backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.7rem', color: '#d97706', fontWeight: 500, textTransform: 'uppercase' }}>
                  Calificación CSAT Promedio
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 500, color: '#d97706', marginTop: '4px' }}>
                  ⭐ {avgCsat} / 5.0
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {ratedTickets.length} encuestas completadas
                </div>
              </div>
            </div>
          </div>

          {/* Tabla de Rendimiento por Programador / Técnico */}
          <div className="card" style={{ padding: '20px', marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 600 }}>
               Rendimiento y Productividad por Programador / Técnico
            </h3>
            <div className="table-wrapper">
              <table className="data-table" style={{ width: '100%', fontSize: '0.825rem' }}>
                <thead>
                  <tr>
                    <th>Programador / Técnico</th>
                    <th>Departamento</th>
                    <th>Tickets Asignados</th>
                    <th>Tickets Resueltos</th>
                    <th>MTTR (Promedio)</th>
                    <th>FCR % (Primer Contacto)</th>
                    <th>Reaperturas</th>
                    <th>CSAT Satisfacción</th>
                  </tr>
                </thead>
                <tbody>
                  {db.employees.map(emp => {
                    const empTickets = tickets.filter(t => t.assigneeId === emp.id);
                    const empResolved = empTickets.filter(t => t.status === 'Cerrado' || t.status === 'Resuelto');
                    
                    let empTotalMs = 0;
                    empResolved.forEach(t => {
                      if (!t.createdAt) return;
                      const start = new Date(t.createdAt.replace(' ', 'T'));
                      const end = t.closedAt ? new Date(t.closedAt.replace(' ', 'T')) : (t.resolvedAt ? new Date(t.resolvedAt.replace(' ', 'T')) : new Date());
                      let dMs = end - start - (t.slaPausedMs || 0);
                      if (dMs > 0) empTotalMs += dMs;
                    });
                    const empMttrMin = empResolved.length > 0 ? Math.round(empTotalMs / (empResolved.length * 1000 * 60)) : 0;
                    const empMttrStr = empMttrMin < 60 ? `${empMttrMin} min` : `${(empMttrMin / 60).toFixed(1)} hrs`;

                    const empFcr = empResolved.filter(t => (t.reopenCount || 0) === 0 && (t.history || []).length <= 3).length;
                    const empFcrPct = empResolved.length > 0 ? Math.round((empFcr / empResolved.length) * 100) : 100;

                    const empReopen = empTickets.filter(t => (t.reopenCount || 0) > 0).length;
                    const empReopenPct = empTickets.length > 0 ? Math.round((empReopen / empTickets.length) * 100) : 0;

                    const empCsatTickets = empTickets.filter(t => typeof t.csatRating === 'number' && t.csatRating > 0);
                    const empAvgCsat = empCsatTickets.length > 0 ? (empCsatTickets.reduce((sum, t) => sum + t.csatRating, 0) / empCsatTickets.length).toFixed(1) : '5.0';

                    return (
                      <tr key={emp.id}>
                        <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{emp.name}</td>
                        <td>{emp.department}</td>
                        <td>{empTickets.length}</td>
                        <td><span className="badge badge-success">{empResolved.length}</span></td>
                        <td><strong>{empMttrStr}</strong></td>
                        <td><span className="badge badge-primary">{empFcrPct}%</span></td>
                        <td><span className={`badge ${empReopenPct > 10 ? 'badge-danger' : 'badge-secondary'}`}>{empReopenPct}%</span></td>
                        <td><strong style={{ color: '#d97706' }}>⭐ {empAvgCsat} / 5.0</strong></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ratios Metrics Grid */}
          <div className="metrics-grid" style={{ marginBottom: '24px' }}>
            <div className="metric-card primary">
              <span className="metric-title">Distribución BD Clientes</span>
              <div className="metric-value" style={{ fontSize: '1.25rem', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span>SQL Server: {sqlCount} ({sqlPercent}%)</span>
                  <span>DBF (Archivos): {dbfCount} ({dbfPercent}%)</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${sqlPercent}%`, backgroundColor: 'var(--primary)', height: '100%' }} />
                  <div style={{ width: `${dbfPercent}%`, backgroundColor: 'var(--info)', height: '100%' }} />
                </div>
              </div>
              <span className="metric-trend" style={{ color: 'var(--text-muted)' }}>Mapeo en tiempo real</span>
            </div>

            <div className="metric-card warning">
              <span className="metric-title">Alertas SLA de Horas</span>
              <div className="metric-value">{slaWarnings.length}</div>
              <span className="metric-trend" style={{ color: 'var(--warning)' }}>
                   Clientes con más de 10 horas de soporte
              </span>
            </div>

            <div className="metric-card success">
              <span className="metric-title">Efectividad de Soporte</span>
              <div className="metric-value">
                {tickets.length ? Math.round((tickets.filter(t => t.status === 'Cerrado').length / tickets.length) * 100) : 100}%
              </div>
              <span className="metric-trend" style={{ color: 'var(--success)' }}>
                Tickets resueltos vs abiertos
              </span>
            </div>
          </div>

          {/* Charts / KPIs details */}
          <div className="grid-cols-2" style={{ gap: '24px', marginBottom: '24px' }}>
            
            {/* Fiscal Printer brand failures */}
            <div className="card">
              <h3 style={{ fontSize: '0.9375rem', marginBottom: '16px', fontWeight: 600 }}>Frecuencia de Fallas por Impresora Fiscal</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(fiscalPrinters).map(([brand, count]) => {
                  const width = (count / maxFiscalCount) * 100;
                  return (
                    <div key={brand} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                        <span>{brand}</span>
                        <span>{count} fallas</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: 'var(--background)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${width}%`,
                          height: '100%',
                          backgroundColor: brand === 'Otros' ? 'var(--text-muted)' : 'var(--primary)',
                          borderRadius: '4px',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Common Pathologies Donut / Percent */}
            <div className="card">
              <h3 style={{ fontSize: '0.9375rem', marginBottom: '16px', fontWeight: 600 }}>Patologías de Software Más Comunes</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {Object.entries(pathologies).map(([name, count], idx) => {
                  const colors = ['var(--primary)', 'var(--info)', 'var(--warning)', 'var(--danger)'];
                  const pct = Math.round((count / totalPathologies) * 100);
                  return (
                    <div key={name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: colors[idx % colors.length] }} />
                        <span style={{ fontWeight: 550 }}>{name}</span>
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
                {totalPathologies === 1 && (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', padding: '10px 0' }}>
                    No hay tickets suficientes para tabular patologías comunes.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tiempos de Respuesta Card */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '0.9375rem', marginBottom: '16px', fontWeight: 600 }}> Tiempo Promedio de Respuesta por Técnico</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Tiempo promedio transcurrido desde la creación del ticket hasta la primera respuesta o cambio de estado realizado por el técnico.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {db.employees.filter(e => e.role === 'Técnico' || e.role === 'Administrador').map(emp => {
                const stats = calculateEmployeeResponseTime(emp.id, tickets);
                const validTimes = db.employees.map(e => calculateEmployeeResponseTime(e.id, tickets).value).filter(v => v !== 999999);
                const maxMinutes = validTimes.length > 0 ? Math.max(...validTimes) : 60;
                const barWidth = stats.value !== 999999 ? Math.max(Math.min((stats.value / maxMinutes) * 100, 100), 5) : 0;
                
                return (
                  <div key={emp.id} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ width: '150px', fontSize: '0.8125rem', fontWeight: 600 }}>{emp.name} ({emp.role})</div>
                    <div style={{ flex: 1, height: '8px', backgroundColor: 'var(--background)', borderRadius: '4px', overflow: 'hidden' }}>
                      {stats.value !== 999999 ? (
                        <div style={{ width: `${barWidth}%`, height: '100%', backgroundColor: 'var(--primary)', borderRadius: '4px' }} />
                      ) : (
                        <div style={{ width: '0%', height: '100%', backgroundColor: 'var(--text-muted)' }} />
                      )}
                    </div>
                    <div style={{ width: '80px', fontSize: '0.8125rem', textAlign: 'right', fontWeight: 500, color: stats.value !== 999999 ? 'var(--primary)' : 'var(--text-muted)' }}>
                      {stats.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AnyDesk Connection Directory */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Directorio de Conexión de Servidores (AnyDesk / IP)</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Acceda y copie la información de AnyDesk y red local de todos los servidores registrados.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Buscar servidor, cliente o AnyDesk..."
                  className="form-input"
                  style={{ width: '220px', padding: '6px 12px', fontSize: '0.8125rem' }}
                  value={searchAnyDesk}
                  onChange={e => setSearchAnyDesk(e.target.value)}
                />
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportAnyDesk}>
                   Exportar Todo
                </button>
              </div>
            </div>

            {filteredServers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No se encontraron servidores registrados o que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Servidor / Rol</th>
                      <th>IP Local</th>
                      <th>Tipo / Versión</th>
                      <th>ID AnyDesk</th>
                      <th>Copiar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredServers.map((srv, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{srv.clientName}</td>
                        <td>{srv.name}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{srv.ip}</td>
                        <td>{srv.type} ({srv.version})</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>
                          {srv.anydesk ? (
                            <a 
                              href={`anydesk://${srv.anydesk.replace(/\s+/g, '')}`} 
                              style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                              title="Conectarse y copiar ID de AnyDesk"
                              onClick={() => copyToClipboard(srv.anydesk, `ID AnyDesk ${srv.anydesk} copiado.`)}
                            >
                              ⚡ {srv.anydesk}
                            </a>
                          ) : (
                            'Sin asignar'
                          )}
                        </td>
                        <td>
                          {srv.anydesk ? (
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '2px 8px', fontSize: '0.7rem', minWidth: 'auto', borderColor: 'var(--success)', color: 'var(--success)' }}
                              onClick={() => copyToClipboard(srv.anydesk, `ID AnyDesk ${srv.anydesk} copiado.`)}
                            >
                              Copiar
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>N/A</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Workstations Directory */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Directorio de Puestos de Trabajo</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Consulte y exporte la información de puestos de trabajo de todos los clientes.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="Buscar puesto, cliente o AnyDesk..."
                  className="form-input"
                  style={{ width: '220px', padding: '6px 12px', fontSize: '0.8125rem' }}
                  value={searchWorkstations}
                  onChange={e => setSearchWorkstations(e.target.value)}
                />
                <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleExportWorkstations}>
                   Descargar Reporte CSV
                </button>
              </div>
            </div>

            {filteredWorkstations.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                No se encontraron puestos de trabajo registrados o que coincidan con la búsqueda.
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Puesto de Trabajo</th>
                      <th>Usuario OS</th>
                      <th>ID AnyDesk</th>
                      <th>Impresora Fiscal</th>
                      <th>Detalles / Observaciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredWorkstations.map((wk, idx) => (
                      <tr key={wk.id || idx}>
                        <td style={{ fontWeight: 500 }}>{wk.clientName}</td>
                        <td style={{ fontWeight: '500' }}>{wk.name}</td>
                        <td>{wk.username || '—'}</td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {wk.anydesk ? (
                              <>
                                <a 
                                  href={`anydesk://${wk.anydesk.replace(/\s+/g, '')}`} 
                                  style={{ color: 'var(--success)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                  title="Conectarse y copiar ID de AnyDesk"
                                  onClick={() => copyToClipboard(wk.anydesk, `ID AnyDesk ${wk.anydesk} copiado.`)}
                                >
                                  ⚡ {wk.anydesk}
                                </a>
                                <button
                                  className="btn btn-secondary"
                                  style={{ padding: '2px 6px', fontSize: '0.65rem', minWidth: 'auto', border: 'none', cursor: 'pointer' }}
                                  onClick={() => copyToClipboard(wk.anydesk, `ID AnyDesk ${wk.anydesk} copiado.`)}
                                  title="Copiar ID de AnyDesk"
                                >
                                  📋
                                </button>
                              </>
                            ) : (
                              'Sin asignar'
                            )}
                          </div>
                        </td>
                        <td>{wk.fiscalPrinter || '—'}</td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{wk.details || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* SLA Hours contract warning */}
          {slaWarnings.length > 0 && (
            <div className="card" style={{ marginBottom: '24px', border: '1px solid var(--danger)', backgroundColor: 'rgba(230, 0, 0, 0.05)' }}>
              <h3 style={{ fontSize: '0.9375rem', color: 'var(--danger)', marginBottom: '12px', fontWeight: 600 }}>
                   Alerta de Contrato SLA Consumido (más de 10 horas de soporte técnico)
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {slaWarnings.map(c => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', backgroundColor: 'var(--background)', padding: '8px 12px', borderRadius: '4px' }}>
                    <span style={{ fontWeight: 500 }}>{c.name}</span>
                    <span style={{ color: 'var(--danger)', fontWeight: 500 }}>{c.hours} horas consumidas</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SQL integration queries */}
          <div className="card">
            <h3 style={{ fontSize: '0.9375rem', marginBottom: '8px', fontWeight: 600 }}>Consultas SQL de Integración (a2 Softway)</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Utilice estos queries en SQL Server para consolidar las tablas del portal de soporte JC con la base de datos nativa de a2 Softway.
            </p>
            
            <div className="grid-cols-2" style={{ gap: '20px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>1. Clientes con Más Fallas y Horas SLA</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto' }}
                    onClick={() => copyToClipboard(sqlQuery1, 'Query 1 copiado')}
                  >
                    Copiar SQL
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '12px',
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  overflowX: 'auto',
                  color: '#39ff14',
                  fontFamily: 'monospace',
                  maxHeight: '180px'
                }}>
                  {sqlQuery1}
                </pre>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>2. Clasificación de Patologías en BD</span>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto' }}
                    onClick={() => copyToClipboard(sqlQuery2, 'Query 2 copiado')}
                  >
                    Copiar SQL
                  </button>
                </div>
                <pre style={{
                  margin: 0,
                  padding: '12px',
                  backgroundColor: 'var(--background)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.7rem',
                  overflowX: 'auto',
                  color: '#39ff14',
                  fontFamily: 'monospace',
                  maxHeight: '180px'
                }}>
                  {sqlQuery2}
                </pre>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* TAB 2: A2 DYNAMIC REPORTS GALLERY             */}
      {/* ───────────────────────────────────────────── */}
      {activeSubTab === 'gallery' && (
        <div>
          {/* Gallery controls / filters bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px' }}>
              <input
                type="text"
                placeholder="Buscar reporte o palabra clave..."
                className="form-input"
                style={{ maxWidth: '300px' }}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <select
                className="form-select"
                style={{ maxWidth: '200px' }}
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
              >
                <option value="all">Todas las Categorías</option>
                {(db.a2Categories || []).map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            
            {(currentUser.role === 'Administrador' || currentUser.id === 'emp-master' || currentUser.role === 'Gerente') && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => { setShowCategoryModal(true); setNewCatName(''); }}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                   Gestionar Categorías
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => {
                    setReportEditId(null);
                    setReportTitle('');
                    setReportDesc('');
                    setReportUtility('');
                    setReportCatId(db.a2Categories?.[0]?.id || '');
                    setReportSql('');
                    setReportFiles([]);
                    setShowReportModal(true);
                  }}
                  style={{ padding: '8px 16px', fontSize: '0.8125rem' }}
                >
                  + Nuevo Reporte
                </button>
              </div>
            )}
          </div>

          {/* Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '24px' }}>
            {filteredReports.map(rep => {
              const cat = (db.a2Categories || []).find(c => c.id === rep.categoryId);
              return (
                <div key={rep.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative', border: '1px solid var(--border)' }}>
                  
                  {/* Card Header & Controls */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div>
                      <span className="badge badge-primary" style={{ fontSize: '0.65rem', textTransform: 'uppercase', marginBottom: '4px', display: 'inline-block', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', border: '1px solid hsla(222,85%,55%,0.3)' }}>
                        {cat ? cat.name : 'Sin Categoría'}
                      </span>
                      <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0 }}>{rep.title}</h3>
                    </div>
                    {(currentUser.role === 'Administrador' || currentUser.id === 'emp-master' || currentUser.role === 'Gerente') && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setReportEditId(rep.id);
                            setReportTitle(rep.title);
                            setReportDesc(rep.description);
                            setReportUtility(rep.utility);
                            setReportCatId(rep.categoryId);
                            setReportSql(rep.sqlQuery);
                            setReportFiles(rep.files || []);
                            setShowReportModal(true);
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '4px' }}
                          title="Editar"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`¿Está seguro de que desea eliminar el reporte "${rep.title}"?`)) {
                              deleteA2Report(rep.id);
                              triggerToast('Reporte eliminado ✓');
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '4px', color: 'var(--danger)' }}
                          title="Eliminar"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: '1.4' }}>
                    {rep.description}
                  </p>

                  {/* Utility Box */}
                  <div style={{ backgroundColor: 'hsla(142,70%,45%,0.06)', borderLeft: '3px solid var(--success)', padding: '10px', borderRadius: '4px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--success)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}> Utilidad del Reporte:</span>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text)', margin: '4px 0 0 0', lineHeight: '1.45' }}>{rep.utility}</p>
                  </div>

                  {/* SQL Code View */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)' }}> Consulta SQL (a2):</span>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto' }}
                        onClick={() => copyToClipboard(rep.sqlQuery, '¡Consulta SQL copiada!')}
                      >
                        Copiar SQL
                      </button>
                    </div>
                    <pre style={{
                      margin: 0,
                      padding: '8px 12px',
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.7rem',
                      overflowX: 'auto',
                      color: '#39ff14',
                      fontFamily: 'monospace',
                      maxHeight: '100px'
                    }}>
                      {rep.sqlQuery}
                    </pre>
                  </div>

                  {/* Attached Files Section */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)' }}> Archivos de Formato / Layouts ({rep.files?.length || 0}):</span>
                    {rep.files && rep.files.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {rep.files.map((file) => (
                          <div key={file.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background)', padding: '6px 10px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                            <span style={{ fontSize: '0.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }} title={file.name}>📄 {file.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>({file.size})</span></span>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '3px 10px', fontSize: '0.65rem', minWidth: 'auto', borderColor: 'var(--success)', color: 'var(--success)' }}
                              onClick={() => {
                                const link = document.createElement('a');
                                link.href = file.dataUrl;
                                link.download = file.name;
                                link.click();
                                triggerToast(`Descargando ${file.name}`);
                              }}
                            >
                              Descargar
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', paddingLeft: '4px' }}>No hay archivos cargados para este reporte.</span>
                    )}
                  </div>

                  {/* Action Button */}
                  <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
                    <button
                      onClick={() => {
                        setPreviewReport(rep);
                        setShowPreviewModal(true);
                      }}
                      className="btn btn-primary"
                      style={{ width: '100%', padding: '8px 12px', fontSize: '0.75rem' }}
                    >
                       Vista Previa (Simulación)
                    </button>
                  </div>

                </div>
              );
            })}

            {filteredReports.length === 0 && (
              <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                 No se encontraron reportes registrados o que coincidan con la búsqueda.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* MODAL: CATEGORY MANAGEMENT                    */}
      {/* ───────────────────────────────────────────── */}
      {showCategoryModal && (
        <Modal onClose={() => setShowCategoryModal(false)} maxWidth="450px">
          <div className="modal-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}> Gestionar Categorías de Reportes</h3>
            <button onClick={() => setShowCategoryModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: 'auto' }}>✕</button>
          </div>
          
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Add Category Form */}
            <form onSubmit={handleCategorySubmit} style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
              <input 
                type="text" 
                className="form-input" 
                placeholder="Nombre de la categoría..." 
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px' }}>Agregar</button>
            </form>

            {/* List Categories */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '250px', overflowY: 'auto' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>Categorías Registradas:</span>
              {(db.a2Categories || []).map(cat => (
                <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>{cat.name}</span>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => {
                      if (window.confirm(`¿Desea eliminar la categoría "${cat.name}"? Los reportes en ella pasarán a Sin Categoría.`)) {
                        deleteA2Category(cat.id);
                        triggerToast('Categoría eliminada ✓');
                      }
                    }}
                    style={{ padding: '2px 8px', fontSize: '0.65rem', minWidth: 'auto', color: 'var(--danger)', borderColor: 'rgba(230,0,0,0.2)' }}
                  >
                    Eliminar
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={() => setShowCategoryModal(false)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* MODAL: ADD / EDIT REPORT                      */}
      {/* ───────────────────────────────────────────── */}
      {showReportModal && (
        <Modal onClose={() => setShowReportModal(false)} maxWidth="520px">
          <div className="modal-header">
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
              {reportEditId ? '✏️ Editar Reporte A2' : '+ Registrar Nuevo Reporte A2'}
            </h3>
            <button onClick={() => setShowReportModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: 'auto' }}>✕</button>
          </div>

          <form onSubmit={handleReportSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div className="form-group">
                <label className="form-label">Título del Reporte *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. Reporte de Ventas Mensuales Fiscal" 
                  value={reportTitle} 
                  onChange={e => setReportTitle(e.target.value)} 
                  required 
                />
              </div>

              <div className="form-group">
                <label className="form-label">Categoría *</label>
                <select 
                  className="form-select" 
                  value={reportCatId} 
                  onChange={e => setReportCatId(e.target.value)}
                  required
                >
                  {(db.a2Categories || []).map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Descripción Breve *</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  placeholder="Escriba de qué trata este reporte..."
                  value={reportDesc} 
                  onChange={e => setReportDesc(e.target.value)} 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Utilidad / Propósito *</label>
                <textarea 
                  className="form-textarea" 
                  rows={2} 
                  placeholder="ej. Permite cuadrar las facturas registradas en a2 con el resumen diario fiscal para auditoría."
                  value={reportUtility} 
                  onChange={e => setReportUtility(e.target.value)} 
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Consulta SQL (Query SQL Server) *</label>
                <textarea 
                  className="form-textarea" 
                  rows={4} 
                  placeholder="SELECT... FROM..."
                  value={reportSql} 
                  onChange={e => setReportSql(e.target.value)} 
                  style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#39ff14', backgroundColor: '#000' }}
                  required
                />
              </div>

              {/* Files Upload Section inside modal */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>Cargar Archivos de Reporte (.rep, .txt, etc.)</span>
                <input 
                  type="file" 
                  multiple 
                  onChange={handleReportFileChange} 
                  style={{ fontSize: '0.8125rem' }} 
                />
                
                {reportFiles.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Archivos agregados listos para guardar:</span>
                    {reportFiles.map((file, idx) => (
                      <div key={file.id || idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 8px', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <span style={{ fontSize: '0.7rem' }}>📄 {file.name} ({file.size})</span>
                        <button 
                          type="button" 
                          onClick={() => setReportFiles(reportFiles.filter((_, i) => i !== idx))} 
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0 }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
            
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">{reportEditId ? 'Guardar Cambios' : 'Registrar Reporte'}</button>
            </div>
          </form>
        </Modal>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* MODAL: SIMULATED REPORT PREVIEW               */}
      {/* ───────────────────────────────────────────── */}
      {showPreviewModal && previewReport && (
        <Modal onClose={() => setShowPreviewModal(false)} maxWidth="750px">
          <div className="modal-header">
            <div>
              <span className="badge badge-success" style={{ fontSize: '0.6rem', marginBottom: '2px', display: 'inline-block' }}>VISTA PREVIA ACTIVA</span>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}> Simulación de Reporte: {previewReport.title}</h3>
            </div>
            <button onClick={() => setShowPreviewModal(false)} className="btn btn-secondary" style={{ padding: '4px 8px', minWidth: 'auto' }}>✕</button>
          </div>
          
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 14px', backgroundColor: 'var(--background)', borderRadius: '4px', border: '1px solid var(--border)', fontSize: '0.8125rem' }}>
              <strong>Propósito del Reporte:</strong> {previewReport.utility}
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    {getMockReportData(previewReport.id).headers.map((h, i) => (
                      <th key={i}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getMockReportData(previewReport.id).rows.map((row, rIdx) => (
                    <tr key={rIdx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} style={{ fontWeight: cIdx === 0 ? 'bold' : 'normal' }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
              * Los datos mostrados en esta tabla son simulados con fines de validación estructural de la base de datos a2.
            </span>
          </div>

          <div className="modal-footer">
            <button 
              className="btn btn-primary"
              onClick={() => window.print()}
            >
               Exportar Reporte a PDF
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const data = getMockReportData(previewReport.id);
                const csvContent = [
                  data.headers.join(','),
                  ...data.rows.map(r => r.join(','))
                ].join('\n');
                copyToClipboard(csvContent, '¡Datos CSV copiados al portapapeles!');
              }}
            >
               Copiar CSV
            </button>
            <button className="btn btn-secondary" onClick={() => setShowPreviewModal(false)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* Printable PDF Template for A2 Reports */}
      {previewReport && (
        <div className="print-report-container">
          <div className="print-header" style={{ borderBottom: '2px solid #000', paddingBottom: '10px', marginBottom: '16px' }}>
            <h2 style={{ margin: 0, fontSize: '16pt' }}>JC ENTERPRISE PORTAL - REPORTE DE SISTEMA A2 SOFTWAY</h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '10pt', color: '#555' }}>
              Reporte: <strong>{previewReport.title}</strong> | Emisión: {new Date().toLocaleDateString('es-ES')}
            </p>
          </div>

          <div style={{ marginBottom: '14px', fontSize: '10pt' }}>
            <strong>Utilidad / Propósito:</strong> {previewReport.utility}
          </div>

          <table className="print-table">
            <thead>
              <tr>
                {getMockReportData(previewReport.id).headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {getMockReportData(previewReport.id).rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}
