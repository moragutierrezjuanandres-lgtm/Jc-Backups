import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

export default function Dashboard() {
  const {
    db,
    currentUser,
    setActiveTab,
    updateAgendaStatus,
    addWeeklyGoal,
    toggleWeeklyGoal
  } = useContext(AppContext);

  const [newGoalText, setNewGoalText] = useState('');

  if (!db || !currentUser) return null;

  const isAdminOrGerente = currentUser.role === 'Administrador' || currentUser.role === 'Gerente';

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

  // --- Dynamic Achievements Calculations ---
  const myResolvedTicketsCount = db.tickets ? db.tickets.filter(t => t && t.assigneeId === currentUser.id && t.status === 'Cerrado').length : 0;
  
  let totalResponseMs = 0;
  let respondedCount = 0;
  const myTickets = db.tickets ? db.tickets.filter(t => t && t.assigneeId === currentUser.id) : [];
  
  myTickets.forEach(t => {
    if (!t || !t.createdAt || !t.history || !Array.isArray(t.history) || t.history.length <= 1) return;
    const created = safeParseDate(t.createdAt);
    if (!created) return;
    const responseEvent = t.history.slice(1).find(h => 
      h && h.action && (
        h.action.includes('Estado cambiado') || 
        h.action.includes('reasignado') ||
        h.user !== 'Cliente'
      )
    );
    if (responseEvent && responseEvent.date) {
      const responded = safeParseDate(responseEvent.date);
      if (responded) {
        const diff = responded.getTime() - created.getTime();
        if (diff > 0) {
          totalResponseMs += diff;
          respondedCount++;
        }
      }
    }
  });
  const myAvgResponseMinutes = respondedCount > 0 ? Math.round(totalResponseMs / (1000 * 60)) : null;

  const achievementsList = [
    {
      id: 'ach-first',
      title: '🛡️ Primer Paso',
      desc: 'Resolver tu primer ticket de soporte',
      target: 1,
      progress: Math.min(myResolvedTicketsCount, 1),
      completed: myResolvedTicketsCount >= 1
    },
    {
      id: 'ach-frequent',
      title: '⚔️ Especialista Técnico',
      desc: 'Resolver 5 tickets de soporte',
      target: 5,
      progress: Math.min(myResolvedTicketsCount, 5),
      completed: myResolvedTicketsCount >= 5
    },
    {
      id: 'ach-hero',
      title: '🏆 Héroe de Infraestructura',
      desc: 'Resolver 10 tickets de soporte',
      target: 10,
      progress: Math.min(myResolvedTicketsCount, 10),
      completed: myResolvedTicketsCount >= 10
    },
    {
      id: 'ach-master',
      title: '👑 Master de JC Portal',
      desc: 'Resolver 25 tickets de soporte',
      target: 25,
      progress: Math.min(myResolvedTicketsCount, 25),
      completed: myResolvedTicketsCount >= 25
    },
    {
      id: 'ach-fast',
      title: '⚡ Veloz y Eficiente',
      desc: 'Tener un tiempo de respuesta promedio menor a 2 horas',
      target: 1,
      progress: (myAvgResponseMinutes !== null && myAvgResponseMinutes <= 120 && myResolvedTicketsCount >= 1) ? 1 : 0,
      completed: myAvgResponseMinutes !== null && myAvgResponseMinutes <= 120 && myResolvedTicketsCount >= 1
    }
  ];

  // --- Calculations for Gerencia/Admin ---
  const activeProjectsCount = db.projects ? db.projects.filter(p => p && p.status === 'En proceso').length : 0;
  const openTicketsCount = db.tickets ? db.tickets.filter(t => t && t.status !== 'Cerrado').length : 0;
  const totalCrmValue = db.crm ? db.crm.reduce((sum, item) => sum + (item && item.stage !== 'Perdido' ? (item.value || 0) : 0), 0) : 0;
  const avgPerformance = db.employees && db.employees.length > 0
    ? Math.round(db.employees.reduce((sum, emp) => sum + (emp?.productivity?.performance || 0), 0) / db.employees.length)
    : 100;
  
  // --- Calculations for Técnicos/Asistentes ---
  const todayStr = new Date().toLocaleDateString('sv'); // Sweden locale prints YYYY-MM-DD
  const myAgendaToday = db.agenda
    ? db.agenda.filter(item => item && item.employeeId === currentUser.id && item.date === todayStr)
    : [];
  const myPendingTasks = db.projects
    ? db.projects.flatMap(p => (p && p.tasks ? p.tasks.filter(t => t && t.assigneeId === currentUser.id && t.status !== 'Completada') : []))
    : [];
  const myCompletedTasksCount = currentUser.productivity?.completed || 0;

  // --- Calculations for Clientes ---
  const isCliente = currentUser.role === 'Cliente';
  const clientObj = isCliente ? db.clients.find(c => c && c.id === currentUser.clientId) : null;

  // --- Dynamic Client Daily Reminders ---
  const todayVal = new Date();
  
  // 1. Visitas de Hoy
  const todayVisits = db.agenda 
    ? db.agenda.filter(act => {
        if (!act) return false;
        const isToday = act.date === todayStr;
        const isActive = act.status !== 'Completado' && act.status !== 'Cancelado';
        const isAssignee = isAdminOrGerente ? true : act.employeeId === currentUser.id;
        return isToday && isActive && isAssignee;
      })
    : [];

  // Helper to compute client inactivity
  const calcClientInactivity = (client) => {
    if (!client) return { ...client, daysInactive: 0 };
    const clientTickets = (db.tickets || []).filter(t => t && t.clientId === client.id);
    let daysInactive = 0;
    
    if (clientTickets.length > 0) {
      const dates = clientTickets.map(t => {
        const d = t && t.createdAt ? safeParseDate(t.createdAt) : null;
        return d ? d.getTime() : 0;
      });
      const maxDate = new Date(Math.max(...dates));
      const diffMs = todayVal - maxDate;
      daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    } else {
      const startStr = client.contractStart;
      if (startStr) {
        const startDate = safeParseDate(startStr);
        if (startDate) {
          const diffMs = todayVal - startDate;
          daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
      } else if (client.id && typeof client.id === 'string' && client.id.startsWith('cli-')) {
        const regTimestamp = parseInt(client.id.replace('cli-', ''), 10);
        if (!isNaN(regTimestamp)) {
          const diffMs = todayVal - new Date(regTimestamp);
          daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        }
      }
    }
    return { ...client, daysInactive };
  };

  // 2. Clientes Inactivos (>30 días sin tickets)
  const inactiveClients = db.clients
    ? db.clients.filter(client => {
        if (!client) return false;
        const type = client.clientType || 'Normal';
        if (type !== 'Normal' || client.status !== 'Activo') return false;
        const obj = calcClientInactivity(client);
        return obj.daysInactive > 30;
      }).map(client => calcClientInactivity(client))
    : [];

  // 3. Tickets Envejecidos (>72 horas)
  const agedTickets = db.tickets
    ? db.tickets.filter(t => {
        if (!t || t.status === 'Cerrado' || !t.createdAt) return false;
        const isAssignee = isAdminOrGerente ? true : t.assigneeId === currentUser.id;
        if (!isAssignee) return false;

        const created = safeParseDate(t.createdAt);
        if (!created) return false;
        const diffMs = todayVal - created;
        const diffHours = diffMs / (1000 * 60 * 60);
        return diffHours > 72;
      }).map(t => {
        const created = safeParseDate(t.createdAt);
        const diffMs = created ? todayVal - created : 0;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        return { ...t, diffHours };
      })
    : [];

  const clientServersCount = clientObj?.infrastructure?.servers?.length || 0;
  const clientOpenTickets = isCliente && db.tickets ? db.tickets.filter(t => t && t.clientId === currentUser.clientId && t.status !== 'Cerrado') : [];
  const clientOpenTicketsCount = clientOpenTickets.length;
  const clientProjects = isCliente && db.projects ? db.projects.filter(p => p && p.clientId === currentUser.clientId) : [];
  const clientProjectsCount = clientProjects.filter(p => p && p.status === 'En proceso').length;

  // Add goal handler
  const handleAddGoal = (e) => {
    e.preventDefault();
    if (!newGoalText.trim()) return;
    addWeeklyGoal(newGoalText);
    setNewGoalText('');
  };

  // --- Calculations for Last Month & Onwards ---
  const now = new Date();
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  const lastMonthIso = lastMonthDate.toISOString().split('T')[0];
  const lastMonthLabel = lastMonthDate.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

  const ticketsLastMonthCount = (db.tickets || []).filter(t => {
    if (!t || !t.createdAt) return true;
    const createdDate = safeParseDate(t.createdAt);
    return createdDate ? createdDate >= lastMonthDate : true;
  }).length;

  const ticketsResolvedLastMonthCount = (db.tickets || []).filter(t => {
    if (!t || t.status !== 'Cerrado') return false;
    const historyItem = (t.history || []).find(h => h && h.action && (h.action.includes('Cerrado') || h.action.includes('cerró')));
    if (historyItem && historyItem.date) {
      const closedDate = safeParseDate(historyItem.date);
      return closedDate ? closedDate >= lastMonthDate : true;
    }
    return true;
  }).length;

  const agendaLastMonthCount = (db.agenda || []).filter(a => {
    return a && a.date && a.date >= lastMonthIso;
  }).length;

  const clientsAddedLastMonth = (db.clients || []).filter(c => {
    if (!c) return false;
    if (c.contractStart) {
      const cDate = safeParseDate(c.contractStart);
      if (cDate && cDate >= lastMonthDate) return true;
    }
    if (c.id && typeof c.id === 'string' && c.id.startsWith('cli-')) {
      const ts = parseInt(c.id.replace('cli-', ''), 10);
      if (!isNaN(ts) && new Date(ts) >= lastMonthDate) return true;
    }
    return false;
  }).length;

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Welcome Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 600, letterSpacing: '-0.03em' }} title="Identificación del usuario activo">
            Hola, {currentUser.name}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {currentUser.role === 'Cliente' 
              ? `Portal de Cliente para ${currentUser.clientName || 'JC Soluciones'}`
              : 'Panel unificado para la gestión operativa y de infraestructura de JC.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} title="Su nivel de acceso y permisos en la plataforma">
            Rol: {currentUser.role}
          </span>
          <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.8125rem' }} title="Estado actual de la sesión conectada">
            En Línea
          </span>
        </div>
      </div>

      {/* Banner de Enfoque Operativo: Último Mes a la Fecha */}
      <div className="card" style={{ padding: '16px 20px', borderLeft: '4px solid var(--primary)', backgroundColor: 'var(--card)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Resumen Operativo & Comercial
          </div>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '1.1rem', fontWeight: 600 }}>
            Información del Último Mes a la Fecha (Desde {lastMonthLabel})
          </h3>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <span className="badge badge-info" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            {ticketsLastMonthCount} Tickets ({ticketsResolvedLastMonthCount} resueltos)
          </span>
          <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            +{clientsAddedLastMonth} Nuevos Clientes
          </span>
          <span className="badge badge-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            {agendaLastMonthCount} Actividades de Agenda
          </span>
        </div>
      </div>

      {/* 🤖 Soporte Automático Integración */}
      <div className="card" style={{ padding: '20px', borderLeft: '4px solid var(--info)' }} title="Canales automatizados para generación de tickets mediante Correo o WhatsApp">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ flex: '1 1 300px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
               Soporte y Apertura Automática de Tickets
            </h3>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '4px', marginBottom: 0 }}>
              Puede reportar fallas e incidencias de infraestructura enviando un correo o mensaje de WhatsApp. El sistema creará el ticket automáticamente incluyendo los adjuntos y fotos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--background)' }} title="Envíe un correo y se convertirá en un ticket de soporte con adjuntos">
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Correo de Soporte</span>
              <strong style={{ fontSize: '0.875rem', color: 'var(--info)' }}>jcetcks@gmail.com</strong>
            </div>
            <div style={{ padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--background)' }} title="Escriba a este número para abrir tickets automáticamente adjuntando fotos">
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>WhatsApp Corporativo</span>
              <strong style={{ fontSize: '0.875rem', color: 'var(--success)' }}>+58 414-4523565</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 📢 Recordatorios Diarios de Clientes */}
      {currentUser.role !== 'Cliente' && (
        <div className="card" style={{ marginTop: '24px', padding: '20px', borderLeft: '4px solid var(--primary)' }} title="Alertas operativas de soporte, inactividad comercial y agenda de hoy">
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             Recordatorios Diarios de Clientes
          </h3>
          {(todayVisits.length === 0 && inactiveClients.length === 0 && agedTickets.length === 0) ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
               No hay alertas o recordatorios para el día de hoy. ¡Todo al día!
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Visitas de hoy */}
              {todayVisits.map(act => (
                <div 
                  key={act.id} 
                  onClick={() => setActiveTab('agenda')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    backgroundColor: 'var(--background)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hover-card"
                  title="Visita programada para hoy. Haga clic para ver su Agenda diaria."
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8125rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>📅</span>
                    <div>
                      <strong>Visita de Hoy:</strong> {act.title} {act.clientName && ` - ${act.clientName}`}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Horario: {act.time} | Asignado a: {db.employees.find(e => e.id === act.employeeId)?.name || 'Sin asignar'}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>Pendiente</span>
                </div>
              ))}

              {/* Clientes inactivos */}
              {inactiveClients.map(client => (
                <div 
                  key={client.id} 
                  onClick={() => setActiveTab('clients')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    backgroundColor: 'var(--background)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hover-card"
                  title="Contrato activo sin registrar incidencias en los últimos 30 días. Requiere llamada de seguimiento."
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8125rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⚠️</span>
                    <div>
                      <strong>Inactividad Comercial:</strong> {client.commercialName}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Sin tickets de soporte desde hace <strong style={{ color: 'var(--warning)' }}>{client.daysInactive} días</strong>.
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-warning" style={{ fontSize: '0.65rem' }}>Seguimiento</span>
                </div>
              ))}

              {/* Tickets envejecidos */}
              {agedTickets.map(t => (
                <div 
                  key={t.id} 
                  onClick={() => setActiveTab('tickets')}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '10px 14px', 
                    backgroundColor: 'var(--background)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)'
                  }}
                  className="hover-card"
                  title="Caso de soporte pendiente por más de 72 horas. Haga clic para ir a responder."
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.8125rem' }}>
                    <span style={{ fontSize: '1.1rem' }}>⏰</span>
                    <div>
                      <strong>Ticket Envejecido:</strong> {t.id} - {t.title}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Abierto hace <strong style={{ color: 'var(--danger)' }}>{t.diffHours} horas</strong>. Cliente: {t.clientName}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>Añejo</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isAdminOrGerente ? (
        /* ================= EXECUTIVE DASHBOARD (ADMIN/GERENTE) ================= */
        <>
          {/* Metrics Section */}
          <div className="metrics-grid">
            <div 
              className="metric-card info" 
              onClick={() => setActiveTab('projects')} 
              style={{ cursor: 'pointer' }}
              title="Total de proyectos activos actualmente en desarrollo. Haga clic para ir a Proyectos."
            >
              <div>
                <span className="metric-title">Proyectos Activos</span>
                <div className="metric-value">{activeProjectsCount}</div>
              </div>
              <span className="metric-trend up">
                Ver todos
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </span>
            </div>

            <div 
              className="metric-card warning" 
              onClick={() => setActiveTab('tickets')} 
              style={{ cursor: 'pointer' }}
              title="Total de tickets de soporte que requieren atención y solución. Haga clic para ir a Soporte."
            >
              <div>
                <span className="metric-title">Tickets Abiertos</span>
                <div className="metric-value">{openTicketsCount}</div>
              </div>
              <span className="metric-trend down">
                Atención Urgente
              </span>
            </div>

            <div 
              className="metric-card success" 
              onClick={() => setActiveTab('crm')} 
              style={{ cursor: 'pointer' }}
              title="Valor estimado acumulado de oportunidades comerciales en curso dentro del CRM. Haga clic para ir a CRM."
            >
              <div>
                <span className="metric-title">Pipeline Comercial</span>
                <div className="metric-value">${totalCrmValue.toLocaleString()}</div>
              </div>
              <span className="metric-trend up">
                Oportunidades
              </span>
            </div>

            <div 
              className="metric-card primary" 
              onClick={() => setActiveTab('employees')} 
              style={{ cursor: 'pointer' }}
              title="Promedio general de cumplimiento de tareas y SLA de todo el personal técnico. Haga clic para ir a Empleados."
            >
              <div>
                <span className="metric-title">Rendimiento Técnico</span>
                <div className="metric-value">{avgPerformance}%</div>
              </div>
              <span className="metric-trend up">
                Promedio General
              </span>
            </div>
          </div>

          {/* Main Dashboard Section Grid */}
          <div className="dashboard-grid">
            {/* Left Column: Projects Progress and Goals */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Projects Tracker */}
              <div className="card" title="Progreso detallado e integrantes líderes de cada proyecto activo">
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></svg>
                  Estado General de Proyectos
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {db.projects.map(proj => (
                    <div key={proj.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }} title={`Progreso del proyecto ${proj.name}: ${proj.progress}%`}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span style={{ fontWeight: 600 }}>{proj.name}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{proj.progress}%</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${proj.progress}%`, height: '100%', backgroundColor: proj.progress > 75 ? 'var(--success)' : 'var(--primary)', borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease' }}></div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        <span>Cliente: {proj.clientName}</span>
                        <span>Líder: {proj.leadName}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Weekly Goals */}
              <div className="card" title="Lista de objetivos estratégicos semanales definidos por gerencia">
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>
                  Metas Semanales de la Gerencia
                </h3>
                <form onSubmit={handleAddGoal} style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
                  <input
                    type="text"
                    placeholder="Nueva meta corporativa..."
                    className="form-input"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    title="Escriba el título del nuevo objetivo semanal de la empresa"
                  />
                  <button type="submit" className="btn btn-primary" title="Presione para guardar esta meta semanal corporativa">Añadir</button>
                </form>
                <div className="agenda-list">
                  {db.weeklyGoals && db.weeklyGoals.map(goal => (
                    <div key={goal.id} className="agenda-item" title="Haga clic en la casilla para marcar esta meta semanal como completada u omitida">
                      <div className="agenda-info" style={{ flex: 1 }}>
                        <div 
                          className={`agenda-checkbox ${goal.completed ? 'checked' : ''}`}
                          onClick={() => {
                            toggleWeeklyGoal(goal.id);
                          }}
                        >
                          {goal.completed && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </div>
                        <span className={`agenda-title ${goal.completed ? 'done' : ''}`}>{goal.title}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                          {goal.progress}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Security Audits & Recent Activities */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card" style={{ height: '100%' }} title="Bitácora de seguridad del sistema en tiempo real">
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                  Monitoreo de Seguridad Activo
                </h3>
                <div className="activity-feed">
                  {db.auditLogs.slice(0, 5).map(log => (
                    <div key={log.id} className="activity-item" title={`Detalles de acción: ${log.details}`}>
                      <div className="activity-icon" style={{ borderColor: log.action === 'Bóveda de Credenciales' ? 'var(--danger)' : 'var(--border)' }}>
                        {log.action === 'Bóveda de Credenciales' ? '🔒' : '👤'}
                      </div>
                      <div className="activity-content">
                        <div className="activity-text">
                          <strong>{log.user}</strong> realizó <strong>{log.action}</strong>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {log.details}
                        </p>
                        <div className="activity-time">{log.timestamp}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setActiveTab('audit')}
                  className="btn btn-secondary"
                  style={{ width: '100%', marginTop: '16px', fontSize: '0.8125rem' }}
                  title="Presione para ver todo el registro de auditoría y bitácora de seguridad del portal"
                >
                  Ver Auditoría Completa
                </button>
              </div>
            </div>
          </div>
        </>
      ) : currentUser.role === 'Cliente' ? (
        /* ================= CLIENT DASHBOARD ================= */
        <>
          {/* Client Metrics Bar */}
          <div className="metrics-grid">
            <div 
              className="metric-card primary" 
              onClick={() => setActiveTab('tickets')} 
              style={{ cursor: 'pointer' }}
              title="Cantidad de tickets de soporte activos y en proceso de solución para su empresa. Haga clic para ver."
            >
              <div>
                <span className="metric-title">Nuestros Tickets Activos</span>
                <div className="metric-value">{clientOpenTicketsCount}</div>
              </div>
              <span className="metric-trend warning">Ver mis tickets</span>
            </div>

            <div 
              className="metric-card success"
              title="Total de servidores, hosts e infraestructura bajo monitoreo de seguridad activo por JC"
            >
              <div>
                <span className="metric-title">Servidores & Equipos</span>
                <div className="metric-value">{clientServersCount}</div>
              </div>
              <span className="metric-trend up">En monitoreo</span>
            </div>

            <div 
              className="metric-card info" 
              onClick={() => setActiveTab('projects')} 
              style={{ cursor: 'pointer' }}
              title="Proyectos activos de mejoras y despliegues en desarrollo. Haga clic para ver."
            >
              <div>
                <span className="metric-title">Proyectos Activos</span>
                <div className="metric-value">{clientProjectsCount}</div>
              </div>
              <span className="metric-trend up">Ver proyectos</span>
            </div>

            <div 
              className="metric-card warning"
              title="Porcentaje actual de cumplimiento de tiempos de respuesta del Acuerdo de Nivel de Servicio (SLA)"
            >
              <div>
                <span className="metric-title">SLA de Soporte Activo</span>
                <div className="metric-value">99.8%</div>
              </div>
              <span className="metric-trend success">Excelente</span>
            </div>
          </div>

          <div className="dashboard-grid">
            {/* Left side: Infrastructure Summary */}
            <div className="card" title="Detalles de servidores monitoreados y credenciales/configuraciones de acceso VPN">
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                 Equipamiento & Acceso VPN
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>Servidores</h4>
                  {clientObj?.infrastructure?.servers && clientObj.infrastructure.servers.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {clientObj.infrastructure.servers.map((srv, idx) => (
                        <div key={idx} style={{ padding: '10px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--background)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }} title={`Servidor IP: ${srv.ip}`}>
                          <div>
                            <strong>{srv.name}</strong> <span style={{ color: 'var(--text-muted)' }}>({srv.type})</span>
                          </div>
                          <code style={{ color: 'var(--info)' }}>{srv.ip}</code>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay servidores registrados.</span>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '8px' }}>Acceso Remoto VPN</h4>
                  {clientObj?.infrastructure?.vpn ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.8125rem' }} title={`Detalles de acceso para VPN IP: ${clientObj.infrastructure.vpn.ip}`}>
                      <div><span style={{ color: 'var(--text-muted)' }}>Servidor VPN:</span> <code>{clientObj.infrastructure.vpn.ip}</code></div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Tipo:</span> {clientObj.infrastructure.vpn.type}</div>
                      <div><span style={{ color: 'var(--text-muted)' }}>Usuario:</span> <code>{clientObj.infrastructure.vpn.user}</code></div>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No configurado.</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right side: Tickets List */}
            <div className="card" title="Listado de reportes de soporte abiertos recientemente">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                   Tickets de Soporte Recientes
                </h3>
                <button 
                  onClick={() => setActiveTab('tickets')}
                  className="btn btn-primary"
                  style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                  title="Presione para crear un nuevo caso de soporte o reportar un incidente técnico"
                >
                  + Abrir Ticket
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {clientOpenTickets.length === 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                    No hay tickets de soporte abiertos.
                  </span>
                ) : (
                  clientOpenTickets.slice(0, 5).map(t => (
                    <div 
                      key={t.id}
                      onClick={() => setActiveTab('tickets')}
                      style={{ 
                        padding: '12px', 
                        border: '1px solid var(--border)', 
                        borderRadius: 'var(--radius-sm)', 
                        backgroundColor: 'var(--background)',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px'
                      }}
                      title="Haga clic para ver el chat de soporte, agregar notas o subir fotos para este ticket"
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>{t.id}</span>
                        <span className={`badge ${t.priority === 'Urgente' ? 'badge-danger' : t.priority === 'Alta' ? 'badge-warning' : 'badge-info'}`}>
                          {t.priority}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t.title}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Categoría: {t.category} | Estado: <strong style={{ color: 'var(--info)' }}>{t.status}</strong></span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ================= OPERATIONAL DASHBOARD (TÉCNICOS/ASISTENTES) ================= */
        <>
          {/* Operational Metrics Bar */}
          <div className="metrics-grid">
            <div 
              className="metric-card primary" 
              onClick={() => setActiveTab('agenda')} 
              style={{ cursor: 'pointer' }}
              title="Número de visitas o asistencias programadas en su agenda de hoy. Haga clic para ver."
            >
              <div>
                <span className="metric-title">Visitas / Apoyos Hoy</span>
                <div className="metric-value">{myAgendaToday.length}</div>
              </div>
              <span className="metric-trend up">Ver mi agenda</span>
            </div>

            <div 
              className="metric-card warning" 
              onClick={() => setActiveTab('projects')} 
              style={{ cursor: 'pointer' }}
              title="Tareas asignadas a usted dentro de los proyectos vigentes que aún no se completan. Haga clic para ver."
            >
              <div>
                <span className="metric-title">Mis Tareas Pendientes</span>
                <div className="metric-value">{myPendingTasks.length}</div>
              </div>
              <span className="metric-trend down">Administrar tareas</span>
            </div>

            <div 
              className="metric-card success"
              title="Total histórico acumulado de tareas de proyectos completadas con éxito"
            >
              <div>
                <span className="metric-title">Mis Tareas Logradas</span>
                <div className="metric-value">{myCompletedTasksCount}</div>
              </div>
              <span className="metric-trend up">Acumulado total</span>
            </div>

            <div 
              className="metric-card info"
              title="Su calificación porcentual de rendimiento laboral basada en cumplimiento de SLA de tickets y agenda"
            >
              <span className="metric-title">Eficiencia Técnica</span>
              <div className="productivity-indicator">
                <div className="productivity-circle-container">
                  {/* Native SVG gauge */}
                  <svg width="70" height="70" viewBox="0 0 36 36">
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--border)"
                      strokeWidth="3.5"
                    />
                    <path
                      d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="3.5"
                      strokeDasharray={`${currentUser.productivity.performance}, 100`}
                    />
                  </svg>
                  <span className="productivity-value-text">{currentUser.productivity.performance}%</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Basado en SLA y calidad.
                </div>
              </div>
            </div>
          </div>

          {/* Operational View Main Grid */}
          <div className="dashboard-grid">
            {/* Left: Today's Agenda list */}
            <div className="card" title="Cronograma y compromisos agendados para la fecha actual">
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
                Mi Agenda para Hoy ({new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })})
              </h3>
              
              {myAgendaToday.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  No tienes actividades programadas para hoy. ¡Buen trabajo!
                </div>
              ) : (
                <div className="agenda-list">
                  {myAgendaToday.map(act => (
                    <div key={act.id} className="agenda-item" title="Haga clic en la casilla para marcar la actividad como completada o pendiente">
                      <div className="agenda-info">
                        <div 
                          className={`agenda-checkbox ${act.status === 'Completado' ? 'checked' : ''}`}
                          onClick={() => {
                            const newStatus = act.status === 'Completado' ? 'Pendiente' : 'Completado';
                            updateAgendaStatus(act.id, newStatus);
                          }}
                        >
                          {act.status === 'Completado' && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                          )}
                        </div>
                        <div>
                          <span className={`agenda-title ${act.status === 'Completado' ? 'done' : ''}`}>{act.title}</span>
                          <div className="agenda-meta">
                            <span>🕒 {act.time}</span>
                            {act.clientName && <span>🏢 {act.clientName}</span>}
                            <span style={{ 
                              color: act.status === 'Completado' ? 'var(--success)' : 
                                     act.status === 'Reprogramado' ? 'var(--warning)' : 
                                     act.status === 'Cancelado' ? 'var(--danger)' : 'var(--info)'
                            }}>[{act.status}]</span>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <select
                          value={act.status}
                          onChange={(e) => updateAgendaStatus(act.id, e.target.value)}
                          className="form-select"
                          style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto' }}
                          title="Cambiar el estado operativo de esta actividad de la agenda"
                        >
                          <option value="Pendiente">Pendiente</option>
                          <option value="Completado">Completado</option>
                          <option value="Reprogramado">Reprogramado</option>
                          <option value="Cancelado">Cancelado</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Assigned Tasks and Tickets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div className="card" title="Tickets de asistencia técnica que tiene asignados para resolver">
                <h3 style={{ fontSize: '1rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                  Mis Tickets Asignados
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {db.tickets.filter(t => t.assigneeId === currentUser.id && t.status !== 'Cerrado').length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                      No posees tickets pendientes de resolución.
                    </span>
                  ) : (
                    db.tickets
                      .filter(t => t.assigneeId === currentUser.id && t.status !== 'Cerrado')
                      .map(t => (
                        <div 
                          key={t.id} 
                          onClick={() => setActiveTab('tickets')}
                          style={{ 
                            padding: '12px', 
                            border: '1px solid var(--border)', 
                            borderRadius: 'var(--radius-sm)', 
                            backgroundColor: 'var(--background)',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px'
                          }}
                          title="Haga clic para ver el ticket y responder al chat de soporte"
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>{t.id}</span>
                            <span className={`badge ${t.priority === 'Urgente' ? 'badge-danger' : t.priority === 'Alta' ? 'badge-warning' : 'badge-info'}`}>
                              {t.priority}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{t.title}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cliente: {t.clientName} | Estado: {t.status}</span>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Achievements Section */}
      {currentUser.role !== 'Cliente' && (
        <div className="card" style={{ marginTop: '24px' }} title="Logros profesionales acumulados por su rendimiento en soporte técnico">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
             Mis Logros y Medallas de Soporte
          </h3>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
            Resuelve tickets y optimiza tus tiempos de respuesta para desbloquear insignias y mejorar tu rendimiento corporativo.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            {achievementsList.map(ach => (
              <div
                key={ach.id}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: ach.completed ? 'rgba(239, 182, 172, 0.08)' : 'var(--background)',
                  border: `1px solid ${ach.completed ? 'var(--primary)' : 'var(--border)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  position: 'relative',
                  opacity: ach.completed ? 1 : 0.65,
                  transition: 'all 0.3s ease'
                }}
                className="hover-card"
                title={ach.desc}
              >
                <div style={{ fontSize: '1.8rem', textAlign: 'center', marginBottom: '4px' }}>
                  {ach.title.split(' ')[0]}
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.875rem', textAlign: 'center', color: ach.completed ? 'var(--primary)' : 'var(--text)' }}>
                  {ach.title.substring(ach.title.indexOf(' ') + 1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', flex: 1 }}>
                  {ach.desc}
                </div>
                
                {/* Progress bar */}
                <div style={{ marginTop: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '3px' }}>
                    <span>Progreso</span>
                    <span>{ach.completed ? 'Desbloqueado' : `${ach.progress}/${ach.target}`}</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(ach.progress / ach.target) * 100}%`,
                      height: '100%',
                      backgroundColor: ach.completed ? 'var(--primary)' : 'var(--text-muted)',
                      borderRadius: '3px'
                    }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
