import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function DailyAgenda() {
  const {
    db,
    currentUser,
    updateAgendaStatus,
    addAgendaItem,
    updateAgendaItem,
    deleteAgendaItem,
    rescheduleAgendaItem
  } = useContext(AppContext);

  const [filterEmpId, setFilterEmpId] = useState(currentUser ? currentUser.id : '');
  const [showAddEvent, setShowAddEvent] = useState(false);
  
  // Form state
  const [evtTitle, setEvtTitle] = useState('');
  const [evtType, setEvtType] = useState('Visita técnica');
  const [evtDate, setEvtDate] = useState(new Date().toISOString().split('T')[0]);
  const [evtTime, setEvtTime] = useState('09:00 - 11:00');
  const [evtClient, setEvtClient] = useState('');
  const [evtAssignee, setEvtAssignee] = useState(currentUser ? currentUser.id : '');

  // Rescheduling Date Modal
  const [rescheduleEvt, setRescheduleEvt] = useState(null);
  const [rescheduleDate, setRescheduleDate] = useState('');

  // Edit Event States
  const [editingEvt, setEditingEvt] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState('Visita técnica');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editAssignee, setEditAssignee] = useState('');

  // Sync state when current logged-in user changes (role switches, logins)
  useEffect(() => {
    if (currentUser) {
      setEvtAssignee(currentUser.id);
      setFilterEmpId(currentUser.id);
    }
  }, [currentUser]);

  if (!db || !currentUser) return null;

  const isAdminOrGerente = currentUser.role === 'Administrador' || currentUser.role === 'Gerente' || currentUser.id === 'emp-master';
  const isMaster = currentUser.role === 'Administrador' || currentUser.id === 'emp-master';

  // Determine whose agenda to view
  const activeViewId = isAdminOrGerente ? filterEmpId : currentUser.id;
  const filteredAgenda = (db.agenda || []).filter(item => item && item.employeeId === activeViewId);
  const selectedEmpObj = (db.employees || []).find(e => e && e.id === activeViewId);

  // Split tasks into Pending and Completed/Cancelled
  const pendingTasks = filteredAgenda.filter(act => act && act.status !== 'Completado' && act.status !== 'Cancelado');
  const completedTasks = filteredAgenda.filter(act => act && (act.status === 'Completado' || act.status === 'Cancelado'));

  // Submit agenda item
  const handleAddEventSubmit = (e) => {
    e.preventDefault();
    if (!evtTitle) return;

    const clientObj = (db.clients || []).find(c => c && c.id === evtClient);

    addAgendaItem({
      employeeId: evtAssignee,
      title: evtTitle,
      type: evtType,
      date: evtDate,
      time: evtTime,
      clientId: evtClient,
      clientName: clientObj ? clientObj.commercialName : 'Interno'
    });

    setEvtTitle('');
    setShowAddEvent(false);
  };

  // Submit reschedule
  const handleRescheduleSubmit = (e) => {
    e.preventDefault();
    if (!rescheduleEvt || !rescheduleDate) return;

    rescheduleAgendaItem(rescheduleEvt.id, rescheduleDate);
    setRescheduleEvt(null);
  };

  const openEditModal = (act) => {
    setEditingEvt(act);
    setEditTitle(act.title);
    setEditType(act.type);
    setEditDate(act.date);
    setEditTime(act.time);
    setEditClient(act.clientId || '');
    setEditAssignee(act.employeeId || '');
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingEvt || !editTitle) return;

    const clientObj = db.clients.find(c => c.id === editClient);
    updateAgendaItem(editingEvt.id, {
      title: editTitle,
      type: editType,
      date: editDate,
      time: editTime,
      clientId: editClient,
      clientName: clientObj ? clientObj.commercialName : 'Interno',
      employeeId: editAssignee
    });

    setEditingEvt(null);
  };

  const renderAgendaItem = (act) => (
    <div key={act.id} className="agenda-item" style={{ padding: '16px 20px' }}>
      <div className="agenda-info" style={{ gap: '16px' }}>
        {/* Status Indicator circle */}
        <div style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: act.status === 'Completado' ? 'var(--success)' :
                          act.status === 'Reprogramado' ? 'var(--warning)' :
                          act.status === 'Cancelado' ? 'var(--danger)' : 'var(--info)'
        }}></div>

        <div>
          <span 
            style={{ 
              fontSize: '0.9375rem', 
              fontWeight: 600, 
              color: act.status === 'Completado' ? 'var(--text-muted)' : 'var(--text)',
              textDecoration: act.status === 'Completado' ? 'line-through' : 'none'
            }}
          >
            {act.title}
          </span>
          
          <div className="agenda-meta" style={{ gap: '14px', marginTop: '4px' }}>
            <span className="badge badge-info" style={{ textTransform: 'uppercase', fontSize: '0.65rem' }}>{act.type}</span>
            <span>📅 {act.date}</span>
            <span>🕒 {act.time}</span>
            {act.clientName && <span>🏢 {act.clientName}</span>}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {(isAdminOrGerente || currentUser.id === act.employeeId) ? (
          <>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem', backgroundColor: 'var(--card)' }}
              onClick={() => updateAgendaStatus(act.id, 'Completado')}
              disabled={act.status === 'Completado'}
            >
              ✓ Completar
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem' }}
              onClick={() => openEditModal(act)}
            >
               Editar
            </button>
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px', fontSize: '0.75rem', color: 'var(--danger)' }}
              onClick={() => {
                if (window.confirm('¿Desea cancelar esta actividad?')) {
                  updateAgendaStatus(act.id, 'Cancelado');
                }
              }}
              disabled={act.status === 'Cancelado'}
            >
              ✕ Cancelar
            </button>
          </>
        ) : (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sin acciones</span>
        )}
      </div>
    </div>
  );


  return (
    <div className="page-container">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Planificación Diaria</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Agenda de visitas, consultoría, desarrollo e instalaciones de soporte.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {(isAdminOrGerente || currentUser.role === 'Técnico') && (
            <button className="btn btn-primary" onClick={() => setShowAddEvent(true)}>
              + Programar Actividad
            </button>
          )}
        </div>
      </div>

      {/* Filter and selector for Admins */}
      {isAdminOrGerente && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
          <span className="form-label" style={{ fontSize: '0.8125rem' }}>Visualizar agenda de:</span>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '8px 12px' }}
            value={filterEmpId}
            onChange={(e) => setFilterEmpId(e.target.value)}
          >
            {db.employees.map(emp => (
              <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
            ))}
          </select>
        </div>
      )}

      {/* Agenda grid/list */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <h3 style={{ fontSize: '1.05rem', marginBottom: '8px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          Actividades Agendadas - {selectedEmpObj ? selectedEmpObj.name : currentUser.name}
        </h3>

        {/* Bloque: Tareas Pendientes */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--primary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span> Actividades Pendientes</span>
            <span className="badge badge-primary" style={{ padding: '2px 8px', fontSize: '0.7rem' }}>{pendingTasks.length}</span>
          </h4>
          {pendingTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8125rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              No hay actividades pendientes programadas para este empleado.
            </div>
          ) : (
            <div className="agenda-list">
              {pendingTasks.map(act => renderAgendaItem(act))}
            </div>
          )}
        </div>

        {/* Bloque: Tareas Completadas */}
        <div>
          <h4 style={{ fontSize: '0.9rem', color: 'var(--success)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span> Actividades Finalizadas</span>
            <span className="badge badge-success" style={{ padding: '2px 8px', fontSize: '0.7rem', backgroundColor: 'rgba(0, 230, 115, 0.1)', color: 'var(--success)', border: '1px solid rgba(0, 230, 115, 0.2)' }}>{completedTasks.length}</span>
          </h4>
          {completedTasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.8125rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
              No hay actividades finalizadas o canceladas en esta agenda.
            </div>
          ) : (
            <div className="agenda-list">
              {completedTasks.map(act => renderAgendaItem(act))}
            </div>
          )}
        </div>
      </div>

      {showAddEvent && (
        <Modal onClose={() => setShowAddEvent(false)}>
            <div className="modal-header">
              <h3>Programar Actividad Técnica</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddEvent(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleAddEventSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título de Actividad</label>
                  <input type="text" placeholder="ej. Instalación de firewall pfsense en core" className="form-input" required value={evtTitle} onChange={e => setEvtTitle(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tipo de Visita/Servicio</label>
                  <select className="form-select" value={evtType} onChange={e => setEvtType(e.target.value)}>
                    <option value="Visita técnica">Visita técnica</option>
                    <option value="Soporte remoto">Soporte remoto</option>
                    <option value="Capacitación">Capacitación</option>
                    <option value="Desarrollo">Desarrollo</option>
                    <option value="Instalación">Instalación</option>
                  </select>
                </div>

                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Fecha</label>
                    <input type="date" className="form-input" required value={evtDate} onChange={e => setEvtDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horario / Bloque</label>
                    <input type="text" placeholder="ej. 09:00 - 13:00" className="form-input" required value={evtTime} onChange={e => setEvtTime(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Cliente Vinculado</label>
                  <select className="form-select" value={evtClient} onChange={e => setEvtClient(e.target.value)}>
                    <option value="">Servicio Interno (Sin cliente)</option>
                    {db.clients.map(c => (
                      <option key={c.id} value={c.id}>{c.commercialName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Asignar a Empleado</label>
                  <select 
                    className="form-select" 
                    required 
                    value={evtAssignee} 
                    onChange={e => setEvtAssignee(e.target.value)}
                    disabled={!isAdminOrGerente}
                  >
                    {db.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddEvent(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Asignar Agenda</button>
              </div>
            </form>
        </Modal>
      )}

      {/* ================= MODAL: RESCHEDULE DATE SELECTOR ================= */}
      {rescheduleEvt && (
        <Modal onClose={() => setRescheduleEvt(null)} maxWidth="400px">
            <div className="modal-header">
              <h3>Reprogramar Actividad</h3>
              <button className="btn btn-secondary" onClick={() => setRescheduleEvt(null)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleRescheduleSubmit}>
              <div className="modal-body">
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Seleccione la nueva fecha para la actividad: <strong>{rescheduleEvt.title}</strong>
                </p>
                <div className="form-group">
                  <label className="form-label">Nueva Fecha</label>
                  <input
                    type="date"
                    className="form-input"
                    required
                    value={rescheduleDate}
                    onChange={e => setRescheduleDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setRescheduleEvt(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Reprogramar</button>
              </div>
            </form>
        </Modal>
      )}

      {/* ================= MODAL: EDIT EVENT ================= */}
      {editingEvt && (
        <Modal onClose={() => setEditingEvt(null)}>
            <div className="modal-header">
              <h3>Editar Actividad</h3>
              <button className="btn btn-secondary" onClick={() => setEditingEvt(null)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título de Actividad</label>
                  <input type="text" placeholder="ej. Instalación de firewall pfsense en core" className="form-input" required value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                </div>
                
                <div className="form-group">
                  <label className="form-label">Tipo de Visita/Servicio</label>
                  <select className="form-select" value={editType} onChange={e => setEditType(e.target.value)}>
                    <option value="Visita técnica">Visita técnica</option>
                    <option value="Soporte remoto">Soporte remoto</option>
                    <option value="Capacitación">Capacitación</option>
                    <option value="Desarrollo">Desarrollo</option>
                    <option value="Instalación">Instalación</option>
                  </select>
                </div>

                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Fecha</label>
                    <input type="date" className="form-input" required value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Horario / Bloque</label>
                    <input type="text" placeholder="ej. 09:00 - 13:00" className="form-input" required value={editTime} onChange={e => setEditTime(e.target.value)} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Cliente Vinculado</label>
                  <select className="form-select" value={editClient} onChange={e => setEditClient(e.target.value)}>
                    <option value="">Servicio Interno (Sin cliente)</option>
                    {db.clients.map(c => (
                      <option key={c.id} value={c.id}>{c.commercialName}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Asignar a Empleado</label>
                  <select className="form-select" required value={editAssignee} onChange={e => setEditAssignee(e.target.value)} disabled={!isAdminOrGerente}>
                    {db.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setEditingEvt(null)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
