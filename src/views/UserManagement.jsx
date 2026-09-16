import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

const ROLES = ['Administrador', 'Gerente', 'Supervisor', 'Técnico', 'Asistente', 'Cliente'];
const DEPARTMENTS = [
  'Soporte e Infraestructura',
  'Administración y Consultoría',
  'Desarrollo de Software',
  'Administración y Soporte',
  'Gerencia',
  'Cliente / Soporte Externo'
];

const ROLE_COLORS = {
  'Administrador': 'var(--danger)',
  'Gerente': 'var(--secondary)',
  'Supervisor': 'var(--warning)',
  'Técnico': 'var(--info)',
  'Asistente': 'var(--success)',
  'Cliente': 'var(--primary)'
};

const PORTAL_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clientes e Infraestructura' },
  { id: 'financials', label: 'Información Financiera (Cuotas de Cobro y Facturación)' },
  { id: 'layouts', label: 'Planos 2D/3D' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'agenda', label: 'Agenda Diaria' },
  { id: 'tickets', label: 'Soporte (Tickets)' },
  { id: 'wiki', label: 'Knowledge Base' },
  { id: 'employees', label: 'Empleados' },
  { id: 'analytics', label: 'Reportes y KPIs' },
  { id: 'audit', label: 'Auditoría' },
  { id: 'users', label: 'Gestión de Usuarios' }
];

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'Técnico',
  department: 'Soporte e Infraestructura', phone: '', status: 'Activo',
  clientId: '', clientName: '', allowedSections: ['dashboard', 'clients', 'layouts', 'projects', 'agenda', 'tickets', 'wiki', 'employees', 'analytics']
};

export default function UserManagement() {
  const { db, currentUser, addEmployee, updateEmployee, deleteEmployee } = useContext(AppContext);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // null = creating new
  const [form, setForm] = useState(EMPTY_FORM);
  const [showPwd, setShowPwd] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');

  // Only admins can access this view
  if (!currentUser || (currentUser.role !== 'Administrador' && currentUser.id !== 'emp-master')) {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🔒</div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '8px' }}>Acceso Restringido</h2>
          <p style={{ fontSize: '0.875rem' }}>Solo el Administrador del sistema puede gestionar usuarios.</p>
        </div>
      </div>
    );
  }

  const handleOpenCreate = () => {
    setEditTarget(null);
    setForm({
      ...EMPTY_FORM,
      allowedSections: ['dashboard', 'clients', 'layouts', 'projects', 'agenda', 'tickets', 'wiki', 'referrals', 'employees', 'analytics']
    });
    setShowPwd(false);
    setShowForm(true);
  };

  const handleOpenEdit = (emp) => {
    setEditTarget(emp.id);
    setForm({
      name: emp.name,
      email: emp.email,
      password: emp.password || '',
      role: emp.role,
      department: emp.department,
      phone: emp.phone,
      status: emp.status,
      clientId: emp.clientId || '',
      clientName: emp.clientName || '',
      allowedSections: emp.allowedSections || []
    });
    setShowPwd(false);
    setShowForm(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || (!editTarget && !form.password)) return;

    if (editTarget) {
      updateEmployee(editTarget, form);
      flash('Usuario actualizado correctamente ✓');
    } else {
      addEmployee(form);
      flash('Usuario creado exitosamente ✓');
    }
    setShowForm(false);
    setEditTarget(null);
  };

  const handleDelete = (empId) => {
    deleteEmployee(empId);
    setConfirmDelete(null);
    flash('Usuario eliminado del sistema ✓');
  };

  const flash = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  if (!db) return null;

  const employees = db.employees;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Gestión de Usuarios</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '4px' }}>
            Administre las cuentas del personal con acceso al portal. Solo visible para Administradores.
          </p>
        </div>
        <button id="btn-create-user" onClick={handleOpenCreate} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
          + Crear Usuario
        </button>
      </div>

      {/* Success flash */}
      {successMsg && (
        <div style={{
          backgroundColor: 'hsla(142,70%,45%,0.15)',
          border: '1px solid var(--success)',
          borderRadius: 'var(--radius-sm)',
          padding: '10px 16px',
          fontSize: '0.875rem',
          color: 'var(--success)',
          fontWeight: 600
        }}>
          {successMsg}
        </div>
      )}

      {/* Stats bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total Usuarios', value: employees.length, color: 'var(--primary)' },
          { label: 'Activos', value: employees.filter(e => e.status === 'Activo').length, color: 'var(--success)' },
          { label: 'Inactivos', value: employees.filter(e => e.status !== 'Activo').length, color: 'var(--danger)' },
          { label: 'Roles Únicos', value: [...new Set(employees.map(e => e.role))].length, color: 'var(--secondary)' }
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 500, color: stat.color }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--background)' }}>
              {['Usuario', 'Correo', 'Rol', 'Departamento', 'Estado', 'Acciones'].map(h => (
                <th key={h} style={{
                  padding: '12px 16px', textAlign: 'left',
                  fontSize: '0.7rem', fontWeight: 600, textTransform: 'uppercase',
                  letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap'
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((emp, i) => (
              <tr
                key={emp.id}
                style={{
                  borderBottom: i < employees.length - 1 ? '1px solid var(--border)' : 'none',
                  backgroundColor: emp.id === currentUser.id ? 'var(--primary-glow)' : 'transparent',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: 'var(--radius-full)',
                      background: 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0
                    }}>
                      {emp.name.split(' ').map(n => n[0]).join('').substring(0,2)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{emp.name}</div>
                      {emp.id === currentUser.id && (
                        <div style={{ fontSize: '0.65rem', color: 'var(--primary)', fontWeight: 600 }}>← TÚ</div>
                      )}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {emp.email}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    color: ROLE_COLORS[emp.role] || 'var(--text)',
                    backgroundColor: `${ROLE_COLORS[emp.role] || 'var(--text)'}22`,
                    border: `1px solid ${ROLE_COLORS[emp.role] || 'var(--border)'}44`
                  }}>
                    {emp.role === 'Cliente' ? `Cliente: ${emp.clientName || 'Sin Vincular'}` : emp.role}
                  </span>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  {emp.department}
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)',
                    fontSize: '0.7rem', fontWeight: 600,
                    color: emp.status === 'Activo' ? 'var(--success)' : 'var(--danger)',
                    backgroundColor: emp.status === 'Activo' ? 'hsla(142,70%,45%,0.12)' : 'hsla(0,84%,60%,0.12)'
                  }}>
                    {emp.status === 'Activo' ? '● Activo' : '○ Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => handleOpenEdit(emp)}
                      className="btn btn-secondary"
                      style={{ padding: '5px 12px', fontSize: '0.75rem', minWidth: 'auto' }}
                    >
                       Editar
                    </button>
                    {emp.id !== currentUser.id && (
                      <button
                        onClick={() => setConfirmDelete(emp)}
                        className="btn"
                        style={{
                          padding: '5px 12px', fontSize: '0.75rem', minWidth: 'auto',
                          backgroundColor: 'hsla(0,84%,60%,0.1)', color: 'var(--danger)',
                          border: '1px solid hsla(0,84%,60%,0.3)'
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create / Edit Modal */}
      {showForm && (
        <Modal onClose={() => setShowForm(false)} maxWidth="520px">
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {editTarget ? '✏️ Editar Usuario' : '+ Crear Nuevo Usuario'}
              </h3>
              <button onClick={() => setShowForm(false)} className="btn btn-secondary" style={{ padding: '5px 10px', minWidth: 'auto' }}>✕</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Nombre Completo *</label>
                    <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Ej: Ana García" required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Correo Electrónico *</label>
                    <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="ana.garcia@jc.com" required />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Teléfono</label>
                    <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="+58 412 000 0000" />
                  </div>

                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label className="form-label">Contraseña *</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        className="form-input"
                        type={showPwd ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => setForm({...form, password: e.target.value})}
                        placeholder={editTarget ? 'Vacía para conservar la contraseña' : 'Mínimo 10 caracteres'}
                        style={{ paddingRight: '44px' }}
                        required={!editTarget}
                        minLength={10}
                      />
                      <button type="button" onClick={() => setShowPwd(!showPwd)} style={{
                        position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1rem'
                      }}>
                        {showPwd ? '🙈' : '👁️'}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Rol *</label>
                    <select className="form-input" value={form.role} onChange={e => {
                      const newRole = e.target.value;
                      let defaultSecs = ['dashboard', 'clients', 'layouts', 'projects', 'agenda', 'tickets', 'wiki', 'referrals', 'employees', 'analytics'];
                      if (newRole === 'Cliente') {
                        defaultSecs = ['dashboard', 'projects', 'tickets', 'wiki'];
                      } else if (newRole === 'Administrador') {
                        defaultSecs = [...defaultSecs, 'audit', 'users'];
                      } else if (newRole === 'Gerente') {
                        defaultSecs = [...defaultSecs, 'audit'];
                      }
                      setForm(prev => ({
                        ...prev,
                        role: newRole,
                        department: newRole === 'Cliente' ? 'Cliente / Soporte Externo' : prev.department,
                        allowedSections: defaultSecs
                      }));
                    }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Estado</label>
                    <select className="form-input" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                      <option value="Activo">Activo</option>
                      <option value="Inactivo">Inactivo</option>
                    </select>
                  </div>

                  {form.role === 'Cliente' ? (
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Cliente Asociado *</label>
                      <select
                        className="form-input"
                        value={form.clientId || ''}
                        onChange={e => {
                          const cli = db.clients.find(c => c.id === e.target.value);
                          setForm(prev => ({
                            ...prev,
                            clientId: e.target.value,
                            clientName: cli ? cli.commercialName : ''
                          }));
                        }}
                        required
                      >
                        <option value="">Seleccionar cliente...</option>
                        {db.clients.map(c => (
                          <option key={c.id} value={c.id}>{c.commercialName}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group" style={{ gridColumn: '1/-1' }}>
                      <label className="form-label">Departamento *</label>
                      <select className="form-input" value={form.department} onChange={e => setForm({...form, department: e.target.value})}>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Portal Permission Checkboxes */}
                  <div className="form-group" style={{ gridColumn: '1/-1', marginTop: '10px' }}>
                    <label className="form-label" style={{ fontWeight: 500, borderBottom: '1px solid var(--border)', paddingBottom: '6px', marginBottom: '10px', display: 'block' }}>
                      Permisos de Acceso al Portal
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                      {PORTAL_SECTIONS.map(section => {
                        const isChecked = (form.allowedSections || []).includes(section.id);
                        return (
                          <label key={section.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8125rem' }}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                const updated = e.target.checked
                                  ? [...(form.allowedSections || []), section.id]
                                  : (form.allowedSections || []).filter(id => id !== section.id);
                                setForm({ ...form, allowedSections: updated });
                              }}
                              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                            />
                            <span>{section.label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" onClick={() => setShowForm(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {editTarget ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
          </form>
        </Modal>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(null)} maxWidth="400px">
            <div className="modal-header">
              <h3 style={{ fontSize: '1rem', color: 'var(--danger)' }}> Confirmar Eliminación</h3>
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary" style={{ padding: '5px 10px', minWidth: 'auto' }}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.875rem', lineHeight: 1.6 }}>
                ¿Está seguro que desea eliminar al usuario <strong>{confirmDelete.name}</strong> ({confirmDelete.role})?
                <br /><br />
                <span style={{ color: 'var(--danger)' }}>Esta acción no se puede deshacer.</span>
              </p>
            </div>
            <div className="modal-footer">
              <button onClick={() => setConfirmDelete(null)} className="btn btn-secondary">Cancelar</button>
              <button
                onClick={() => handleDelete(confirmDelete.id)}
                className="btn"
                style={{ backgroundColor: 'var(--danger)', color: '#fff' }}
              >
                Eliminar Usuario
              </button>
            </div>
        </Modal>
      )}
    </div>
  );
}
