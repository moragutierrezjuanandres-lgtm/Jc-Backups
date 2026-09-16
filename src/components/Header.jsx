import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';

export default function Header() {
  const {
    db,
    activeTab,
    theme,
    setTheme,
    currentUser,
    logout,
    notifications,
    clearNotifications
  } = useContext(AppContext);

  // Calculate user achievements count
  const myResolvedTicketsCount = db && db.tickets ? db.tickets.filter(t => t.assigneeId === currentUser?.id && t.status === 'Cerrado').length : 0;
  
  let totalResponseMs = 0;
  let respondedCount = 0;
  const myTickets = db && db.tickets ? db.tickets.filter(t => t.assigneeId === currentUser?.id) : [];
  
  myTickets.forEach(t => {
    if (!t.createdAt || !t.history || t.history.length <= 1) return;
    const created = new Date(t.createdAt.replace(' ', 'T'));
    const responseEvent = t.history.slice(1).find(h => 
      h.action.includes('Estado cambiado') || 
      h.action.includes('reasignado') ||
      h.user !== 'Cliente'
    );
    if (responseEvent && responseEvent.date) {
      const responded = new Date(responseEvent.date.replace(' ', 'T'));
      const diff = responded - created;
      if (diff > 0) {
        totalResponseMs += diff;
        respondedCount++;
      }
    }
  });
  const myAvgResponseMinutes = respondedCount > 0 ? Math.round(totalResponseMs / (1000 * 60)) : null;

  const achievementsCount = (currentUser && currentUser.role !== 'Cliente') ? [
    myResolvedTicketsCount >= 1,
    myResolvedTicketsCount >= 5,
    myResolvedTicketsCount >= 10,
    myResolvedTicketsCount >= 25,
    (myAvgResponseMinutes !== null && myAvgResponseMinutes <= 120 && myResolvedTicketsCount >= 1)
  ].filter(Boolean).length : 0;

  const [showNotifPanel, setShowNotifPanel] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const tabTitles = {
    backups: 'Centro de respaldos',
    dashboard: 'Tablero Principal',
    clients: 'Ficha de Clientes e Infraestructura',
    projects: 'Gestión de Proyectos y Kanban',
    agenda: 'Planificación y Agenda Diaria',
    tickets: 'Centro de Soporte Técnico',
    wiki: 'Base de Conocimiento (Wiki)',
    jc: 'Wiki y Utilitarios (Jc)',
    crm: 'Oportunidades Comerciales CRM',
    employees: 'Directorio de Personal',
    analytics: 'Indicadores de Desempeño y Analíticas',
    audit: 'Seguridad y Auditoría',
    users: 'Gestión de Usuarios del Sistema'
  };

  const currentTitle = tabTitles[activeTab] || 'JC Enterprise Portal';
  const unread = notifications.filter(n => !n.read).length;

  return (
    <header className="header-bar" style={{
      display: 'flex',
      alignItems: 'center',
      justify: 'space-between',
      padding: '0 24px',
      height: '52px',
      backgroundColor: 'var(--card)',
      borderBottom: '1px solid var(--border)',
      position: 'sticky',
      top: 0,
      zIndex: 500
    }}>
      {/* Header Brand & Active Section Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600, fontSize: '1.1rem' }}>
          <span style={{ color: 'var(--primary)', letterSpacing: '-0.5px' }}>JC Enterprise</span>
          <span style={{ color: 'var(--border)', fontWeight: 300, fontSize: '1.1rem' }}>|</span>
          <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)' }}>{currentTitle}</span>
        </div>
      </div>

      <div className="header-actions">
        {/* Theme Toggler */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="btn btn-secondary"
          style={{ padding: '8px', borderRadius: 'var(--radius-full)' }}
          title="Cambiar Tema"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {/* Notifications Center */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setShowNotifPanel(!showNotifPanel); setShowUserMenu(false); }}
            className="notifications-bell"
            style={{ border: 'none', background: 'none' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread > 0 && <span className="bell-badge"></span>}
          </button>

          {showNotifPanel && (
            <div
              className="card"
              style={{
                position: 'absolute', top: '45px', right: '0', width: '300px', zIndex: 600,
                padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px',
                boxShadow: 'var(--shadow-lg)', backgroundColor: 'var(--card)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500 }}>
                  Notificaciones {unread > 0 && <span style={{ color: 'var(--primary)' }}>({unread})</span>}
                </span>
                {notifications.length > 0 && (
                  <button onClick={clearNotifications} style={{ fontSize: '0.7rem', color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer' }}>
                    Limpiar
                  </button>
                )}
              </div>
              <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {notifications.length === 0 ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center', padding: '10px' }}>
                    No hay notificaciones
                  </span>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} style={{ display: 'flex', flexDirection: 'column', paddingBottom: '6px', borderBottom: '1px solid var(--background)' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text)' }}>{n.text}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', alignSelf: 'flex-end' }}>{n.time}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar + Dropdown */}
        {currentUser && (
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifPanel(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                background: 'var(--card)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-full)', padding: '4px 10px 4px 4px',
                cursor: 'pointer', transition: 'all var(--transition-fast)'
              }}
            >
              <div style={{
                width: '28px', height: '28px', borderRadius: 'var(--radius-full)',
                background: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 600, fontSize: '0.7rem'
              }}>
                {currentUser.name.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div style={{ textAlign: 'left', display: 'none' }} className="user-name-desktop">
                <div style={{ fontSize: '0.75rem', fontWeight: 600, lineHeight: 1 }}>{currentUser.name.split(' ')[0]}</div>
                <div style={{ fontSize: '0.6rem', color: 'var(--primary)', lineHeight: 1.2 }}>{currentUser.role}</div>
              </div>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>▼</span>
            </button>

            {showUserMenu && (
              <div
                className="card"
                style={{
                  position: 'absolute', top: '44px', right: '0', minWidth: '200px', zIndex: 600,
                  padding: '8px', boxShadow: 'var(--shadow-lg)'
                }}
              >
                <div style={{ padding: '8px 12px 10px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{currentUser.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentUser.email}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 600 }}>{currentUser.role}</div>
                    {currentUser.role !== 'Cliente' && achievementsCount > 0 && (
                      <span 
                        style={{ 
                          fontSize: '0.65rem', 
                          backgroundColor: 'var(--primary-glow)', 
                          color: 'var(--primary)', 
                          border: '1px solid var(--primary)',
                          borderRadius: 'var(--radius-full)', 
                          padding: '1px 6px',
                          fontWeight: 500,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px'
                        }}
                        title={`${achievementsCount} de 5 logros de soporte obtenidos`}
                      >
                        🏅 {achievementsCount} Logros
                      </span>
                    )}
                  </div>
                </div>

                {/* Logout */}
                <button
                  onClick={() => { setShowUserMenu(false); logout(); }}
                  style={{
                    width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '8px 12px', borderRadius: 'var(--radius-xs)',
                    fontSize: '0.8125rem', color: 'var(--danger)',
                    transition: 'background var(--transition-fast)'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'hsla(0,84%,60%,0.1)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <span>⏻</span> Cerrar Sesión
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
