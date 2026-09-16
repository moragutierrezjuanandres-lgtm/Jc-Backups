import React, { useContext } from 'react';
import { AppContext } from '../context/AppContext';
import LogoSvg from './LogoSvg';

export default function Navigation() {
  const { activeTab, setActiveTab, currentUser, logout } = useContext(AppContext);

  if (!currentUser) return null;

  const isAdmin = currentUser.role === 'Administrador' || currentUser.id === 'emp-master';
  const isAdminOrGerente = isAdmin || currentUser.role === 'Gerente';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', title: 'Ver resumen general, metas de la semana y estadísticas básicas', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
        <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
      </svg>
    )},
    { id: 'clients', label: 'Clientes e Infra.', title: 'Gestionar fichas técnicas, credenciales e infraestructura de clientes', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </svg>
    )},

    { id: 'projects', label: 'Proyectos', title: 'Ver y gestionar el progreso de proyectos y tareas (Kanban / Lista)', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M9 3v18" /><path d="M15 3v18" /><path d="M3 9h18" /><path d="M3 15h18" />
      </svg>
    )},
    { id: 'agenda', label: 'Agenda Diaria', title: 'Planificar actividades, citas y tareas programadas por fecha', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    )},
    { id: 'tickets', label: 'Soporte (Tickets)', title: 'Atender reportes de fallas y soporte técnico de clientes', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    )},
    { id: 'jc', label: 'Jc', title: 'Wiki, Utilitarios y Respaldos a2 Softway de JC Services', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    )},
    { id: 'employees', label: 'Empleados', title: 'Visualizar directorio de personal de la empresa', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    )},
    { id: 'analytics', label: 'Reportes y KPIs', title: 'Analizar indicadores clave de rendimiento (KPIs) y gráficos', icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    )}
  ];

  // Audit for admins and managers, or if explicitly allowed
  if (isAdminOrGerente || (currentUser.allowedSections && currentUser.allowedSections.includes('audit'))) {
    menuItems.push({
      id: 'audit',
      label: 'Auditoría',
      title: 'Consultar bitácora de auditoría y registros de seguridad del sistema',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      )
    });
  }

  // User Management for admins, or if explicitly allowed
  if (isAdmin || (currentUser.allowedSections && currentUser.allowedSections.includes('users'))) {
    menuItems.push({
      id: 'users',
      label: 'Gestión de Usuarios',
      title: 'Administrar cuentas de usuario, roles y permisos de acceso',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="4" />
          <path d="M20 21a8 8 0 1 0-16 0" />
          <path d="M19 11l2 2-4 4" />
        </svg>
      )
    });
  }

  // Filter based on allowedSections or role default fallback
  const activeMenuItems = currentUser.id === 'emp-master'
    ? menuItems
    : (currentUser.allowedSections && Array.isArray(currentUser.allowedSections)
        ? menuItems.filter(item => {
            if (item.id === 'jc') {
              return currentUser.allowedSections.includes('wiki') || currentUser.allowedSections.includes('jc') || currentUser.allowedSections.includes('utilitarios');
            }
            return currentUser.allowedSections.includes(item.id);
          })
        : (currentUser.role === 'Cliente'
            ? menuItems.filter(item => ['dashboard', 'projects', 'tickets', 'jc'].includes(item.id))
            : menuItems));

  const mobileMenuItems = activeMenuItems.filter(item =>
    currentUser.role === 'Cliente'
      ? ['dashboard', 'projects', 'tickets', 'jc'].includes(item.id)
      : ['dashboard', 'clients', 'projects', 'tickets', 'agenda'].includes(item.id)
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            background: 'var(--card-hover)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '5px',
            flexShrink: 0
          }}>
            <LogoSvg style={{ width: '100%', height: '100%', color: 'var(--text)' }} />
          </div>
          <span className="sidebar-logo-text">JC Portal</span>
        </div>

        <nav className="sidebar-menu">
          {activeMenuItems.map(item => (
            <button
              key={item.id}
              className={`btn btn-secondary sidebar-item ${activeTab === item.id ? 'active' : ''}`}
              style={{
                border: 'none',
                justifyContent: 'flex-start',
                color: item.id === 'users' ? 'var(--warning)' : undefined
              }}
              onClick={() => setActiveTab(item.id)}
              title={item.title}
            >
              {item.icon}
              {item.label}
              {item.id === 'users' && (
                <span style={{
                  marginLeft: 'auto', fontSize: '0.6rem', padding: '2px 6px',
                  borderRadius: 'var(--radius-full)',
                  backgroundColor: 'hsla(38,92%,50%,0.15)', color: 'var(--warning)',
                  border: '1px solid hsla(38,92%,50%,0.3)', fontWeight: 600
                }}>ADMIN</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sesión Activa</span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentUser.name}</span>
            <span style={{ fontSize: '0.6875rem', color: 'var(--primary)' }}>{currentUser.role}</span>
          </div>
          <button
            onClick={logout}
            title="Cerrar Sesión actual de usuario"
            style={{
              background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
              cursor: 'pointer', color: 'var(--text-muted)', padding: '6px 8px',
              transition: 'all var(--transition-fast)', fontSize: '1rem', flexShrink: 0
            }}
            onMouseEnter={e => { e.target.style.color = 'var(--danger)'; e.target.style.borderColor = 'var(--danger)'; }}
            onMouseLeave={e => { e.target.style.color = 'var(--text-muted)'; e.target.style.borderColor = 'var(--border)'; }}
          >
            ⏻
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Bottom Bar */}
      <nav className="mobile-nav">
        {mobileMenuItems.map(item => (
          <div
            key={item.id}
            className={`mobile-nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => setActiveTab(item.id)}
            title={item.title}
          >
            {item.icon}
            <span>{item.id === 'clients' ? 'Infra.' : item.label}</span>
          </div>
        ))}
      </nav>
    </>
  );
}
