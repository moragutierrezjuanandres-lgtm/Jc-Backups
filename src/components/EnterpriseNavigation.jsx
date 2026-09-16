import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import LogoSvg from './LogoSvg';
const groups = [
  ['ESPACIO DE TRABAJO', [['dashboard','Resumen','grid'],['clients','Clientes','clients'],['projects','Proyectos','grid'],['agenda','Agenda','calendar']]],
  ['SERVICIOS', [['tickets','Centro de soporte','support'],['backups','Respaldos','database'],['jc','Conocimiento','book'],['analytics','Reportes','chart']]],
  ['ADMINISTRACIÓN', [['employees','Equipo','clients'],['audit','Auditoría','shield'],['users','Usuarios y permisos','shield']]]
];
export function MenuIcon({ name }) {
  const paths = { grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></>, clients: <><circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>, database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0"/></>, calendar: <><rect x="3" y="5" width="18" height="16"/><path d="M3 10h18M8 2v6M16 2v6"/></>, support: <><path d="M4 13v-1a8 8 0 0 1 16 0v1M4 13h3v7H4zM17 13h3v7h-3zM17 20l-3 2h-3"/></>, book: <path d="M4 3h16v18H6a2 2 0 0 1-2-2zm0 14h16M8 7h8M8 11h6"/>, chart: <path d="M4 3v18h17M9 17v-5M14 17V8M19 17V4"/>, shield: <path d="M12 2l8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5zM8 12l3 3 5-6"/> };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}
export default function Navigation() {
  const { activeTab, setActiveTab, currentUser, logout } = useContext(AppContext);
  const [open, setOpen] = useState(false);
  if (!currentUser) return null;
  const can = id => currentUser.role === 'Administrador' || id === 'dashboard' || (id === 'backups' ? currentUser.role !== 'Cliente' && (currentUser.allowedSections?.includes('clients') || currentUser.allowedSections?.includes('backups')) : id === 'jc' ? ['wiki','jc','utilitarios'].some(s => currentUser.allowedSections?.includes(s)) : currentUser.allowedSections?.includes(id) || (!currentUser.allowedSections && currentUser.role !== 'Cliente'));
  return <><button className="mobile-menu-toggle btn btn-secondary" onClick={() => setOpen(!open)} aria-label="Abrir navegación" aria-expanded={open}>☰</button>{open && <button className="nav-scrim" aria-label="Cerrar navegación" onClick={() => setOpen(false)} />}<aside className={`sidebar enterprise-sidebar ${open ? 'is-open' : ''}`}><div className="sidebar-logo"><LogoSvg style={{width:32,height:32}}/><div><strong>JC ENTERPRISE</strong><small>Portal de operaciones</small></div></div><nav className="sidebar-menu" aria-label="Navegación principal">{groups.map(([label, items]) => { const visible = items.filter(([id]) => can(id)); return visible.length ? <section key={label}><h2 className="nav-group-label">{label}</h2>{visible.map(([id,label,icon]) => <button key={id} className={`sidebar-item ${activeTab === id ? 'active' : ''}`} aria-current={activeTab === id ? 'page' : undefined} onClick={() => {setActiveTab(id);setOpen(false);}}><MenuIcon name={icon}/>{label}</button>)}</section> : null; })}</nav><div className="sidebar-footer"><div className="user-avatar">{currentUser.name?.slice(0,2).toUpperCase()}</div><div><strong>{currentUser.name}</strong><small>{currentUser.role}</small></div><button className="logout-button" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">↪</button></div></aside></>;
}
