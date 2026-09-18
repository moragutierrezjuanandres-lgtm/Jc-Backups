import { publicEmployee } from './auth.js';
export const admin = user => user?.role === 'Administrador';
export const allowed = (user, section) => !!user && (admin(user) || (user.role !== 'Cliente' && (user.allowedSections?.includes(section) || (!user.allowedSections && user.role !== 'Cliente'))));
export const backupsAllowed = user => allowed(user, 'backups') || allowed(user, 'clients');
const sections = { clients: 'clients', projects: 'projects', agenda: 'agenda', weeklyGoals: 'dashboard', tickets: 'tickets', knowledgeBase: 'wiki', utilitarios: 'utilitarios', referrals: 'referrals', a2Categories: 'analytics', a2Reports: 'analytics', ticketCategories: 'tickets', serviceReports: 'tickets', crm: 'crm' };
export function canWrite(user, collection) {
  if (collection === 'employees') return admin(user);
  if (collection === 'notifications') return user.role !== 'Cliente';
  if (user.role === 'Cliente') return ['tickets', 'projects'].includes(collection);
  return !!sections[collection] && allowed(user, sections[collection]);
}
export function visibleDb(db, user) {
  const result = {};
  for (const [key, value] of Object.entries(db)) {
    if (key === 'employees') result[key] = (value || []).map(e => admin(user) ? publicEmployee(e) : { id: e.id, name: e.name, role: e.role, department: e.department, status: e.status });
    else if (key === 'auditLogs') result[key] = allowed(user, 'audit') ? value : [];
    else if (key === 'backups') result[key] = [];
    else if (key === 'notifications') result[key] = value.filter(n => !n.recipientId || n.recipientId === user.id);
    else if (user.role === 'Cliente') {
      result[key] = ['tickets', 'projects', 'serviceReports'].includes(key) && user.clientId ? value.filter(r => r.clientId === user.clientId) : [];
    } else result[key] = sections[key] && allowed(user, sections[key]) ? value : [];
  }
  return result;
}
