import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Employees() {
  const { db } = useContext(AppContext);
  const [selectedEmp, setSelectedEmp] = useState(null);

  if (!db) return null;

  const calculateEmployeeResponseTime = (employeeId) => {
    const tickets = db.tickets || [];
    const empTickets = tickets.filter(t => t.assigneeId === employeeId);
    let totalMs = 0;
    let count = 0;
    
    empTickets.forEach(t => {
      if (!t.createdAt || !t.history || t.history.length <= 1) return;
      const tCreated = new Date(t.createdAt.replace(' ', 'T'));
      const responseEvent = t.history.slice(1).find(h => 
        h.action.includes('Estado cambiado') || 
        h.action.includes('reasignado') ||
        h.user !== 'Cliente'
      );
      
      if (responseEvent && responseEvent.date) {
        const tResponded = new Date(responseEvent.date.replace(' ', 'T'));
        const diff = tResponded - tCreated;
        if (diff > 0) {
          totalMs += diff;
          count++;
        }
      }
    });
    
    if (count === 0) return 'N/A';
    const avgMinutes = Math.round(totalMs / (1000 * 60));
    if (avgMinutes < 60) {
      return `${avgMinutes} min`;
    }
    const avgHours = (avgMinutes / 60).toFixed(1);
    return `${avgHours} hrs`;
  };

  const getEmployeeAchievements = (employeeId) => {
    const tickets = db.tickets || [];
    const empResolvedTickets = tickets.filter(t => t.assigneeId === employeeId && t.status === 'Cerrado');
    const empResolvedCount = empResolvedTickets.length;
    
    // Average response time calculation
    let totalResponseMs = 0;
    let respondedCount = 0;
    const empTickets = tickets.filter(t => t.assigneeId === employeeId);
    
    empTickets.forEach(t => {
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
    
    const avgResponseMinutes = respondedCount > 0 ? Math.round(totalResponseMs / (1000 * 60)) : null;
    
    const achievements = [
      {
        id: 'ach-first',
        title: '🛡️ Primer Paso',
        desc: 'Resolver primer ticket de soporte',
        completed: empResolvedCount >= 1
      },
      {
        id: 'ach-frequent',
        title: '⚔️ Especialista',
        desc: 'Resolver 5 tickets',
        completed: empResolvedCount >= 5
      },
      {
        id: 'ach-hero',
        title: '🏆 Héroe',
        desc: 'Resolver 10 tickets',
        completed: empResolvedCount >= 10
      },
      {
        id: 'ach-master',
        title: '👑 Master',
        desc: 'Resolver 25 tickets',
        completed: empResolvedCount >= 25
      },
      {
        id: 'ach-fast',
        title: '⚡ Veloz',
        desc: 'Respuesta < 2 hrs',
        completed: avgResponseMinutes !== null && avgResponseMinutes <= 120 && empResolvedCount >= 1
      }
    ];
    
    return achievements;
  };

  return (
    <div className="page-container">
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>Directorio de Empleados</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Registro oficial de personal, áreas operativas y métricas de desempeño.
        </p>
      </div>

      {/* 🏆 Tabla de Productividad & Ranking de Desempeño */}
      <div className="card" style={{ marginBottom: '24px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
           Tabla de Productividad & Ranking de Desempeño
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[...db.employees]
            .sort((a, b) => {
              if ((b.productivity?.performance ?? 0) !== (a.productivity?.performance ?? 0)) {
                return (b.productivity?.performance ?? 0) - (a.productivity?.performance ?? 0);
              }
              return (b.productivity?.completed ?? 0) - (a.productivity?.completed ?? 0);
            })
            .map((emp, index) => {
              const performance = (emp.productivity?.performance ?? 0);
              const completed = (emp.productivity?.completed ?? 0);
              const rank = index + 1;
              const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
              
              // Determine status indicator color and text
              let barColor = 'var(--danger)'; // Red
              let statusText = 'En Revisión';
              if (performance >= 90) {
                barColor = 'var(--success)'; // Green
                statusText = 'Sobresaliente';
              } else if (performance >= 70) {
                barColor = 'var(--warning)'; // Yellow/Orange
                statusText = 'Óptimo';
              }

              return (
                <div 
                  key={emp.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    padding: '12px 16px', 
                    backgroundColor: 'var(--background)', 
                    border: '1px solid var(--border)', 
                    borderRadius: 'var(--radius-sm)',
                    gap: '16px',
                    flexWrap: 'wrap'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1 1 250px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 500, width: '32px', textAlign: 'center' }}>
                      {rankIcon}
                    </div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{emp.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{emp.role}</div>
                    </div>
                  </div>

                  {/* Progress Bar & SLA */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '2 1 200px', minWidth: '150px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Cumplimiento SLA</span>
                      <strong style={{ color: barColor }}>{performance}% ({statusText})</strong>
                    </div>
                    <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div style={{ width: `${performance}%`, height: '100%', backgroundColor: barColor, borderRadius: 'var(--radius-full)', transition: 'width 0.5s ease-in-out' }} />
                    </div>
                  </div>

                  {/* Tasks count */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flex: '0 0 150px', fontSize: '0.8125rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)' }}>Logrado: </span>
                      <strong style={{ color: 'var(--success)' }}>{completed}</strong>
                    </div>
                    {emp.role !== 'Cliente' && (
                      <div style={{ display: 'flex', gap: '2px', fontSize: '0.85rem' }}>
                        {getEmployeeAchievements(emp.id).filter(a => a.completed).map(a => (
                          <span key={a.id} title={`${a.title}: ${a.desc}`} style={{ cursor: 'help' }}>{a.title.split(' ')[0]}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
        {db.employees.map(emp => (
          <div 
            key={emp.id} 
            className="card" 
            onClick={() => setSelectedEmp(emp)}
            style={{ 
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              position: 'relative'
            }}
          >
            {/* Header profile info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div 
                style={{ 
                  width: '44px', 
                  height: '44px', 
                  borderRadius: 'var(--radius-full)', 
                  background: 'var(--primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: 500,
                  fontSize: '1.1rem'
                }}
              >
                {emp.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>{emp.name}</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>{emp.role}</span>
              </div>
            </div>

            {/* General Info */}
            <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
              <div><span style={{ color: 'var(--text-muted)' }}>Área:</span> {emp.department}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Email:</span> {emp.email}</div>
              <div><span style={{ color: 'var(--text-muted)' }}>Tlf:</span> {emp.phone}</div>
            </div>

            {/* Performance Indicators */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--background)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Logrado</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--success)' }}>{(emp.productivity?.completed ?? 0)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Activo</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--info)' }}>{(emp.productivity?.active ?? 0)}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>SLA</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)' }}>{(emp.productivity?.performance ?? 0)}%</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Resp.</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--primary)' }}>{calculateEmployeeResponseTime(emp.id)}</div>
              </div>
            </div>

            {/* Medals summary on Card */}
            {emp.role !== 'Cliente' && getEmployeeAchievements(emp.id).some(a => a.completed) && (
              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', fontSize: '1rem', marginTop: '4px', borderTop: '1px dashed var(--border)', paddingTop: '8px' }}>
                {getEmployeeAchievements(emp.id).filter(a => a.completed).map(a => (
                  <span key={a.id} title={`${a.title}: ${a.desc}`} style={{ cursor: 'help' }}>{a.title.split(' ')[0]}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedEmp && (
        <Modal onClose={() => setSelectedEmp(null)} maxWidth="580px">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Ficha del Empleado</h3>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => window.print()}
                  style={{ padding: '4px 8px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                   Reporte PDF
                </button>
              </div>
              <button 
                onClick={() => setSelectedEmp(null)} 
                className="btn btn-secondary" 
                style={{ padding: '6px 12px', minWidth: 'auto' }}
              >
                ✕
              </button>
            </div>
            
            <div className="modal-body" style={{ gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div 
                  style={{ 
                    width: '60px', 
                    height: '60px', 
                    borderRadius: 'var(--radius-full)', 
                    background: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ffffff',
                    fontWeight: 500,
                    fontSize: '1.35rem'
                  }}
                >
                  {selectedEmp.name.split(' ').map(n => n[0]).join('')}
                </div>
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>{selectedEmp.name}</h2>
                  <span className="badge badge-primary">{selectedEmp.role}</span>
                  <span className="badge badge-success" style={{ marginLeft: '8px' }}>{selectedEmp.status}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', backgroundColor: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div>
                  <span className="form-label" style={{ fontSize: '0.7rem' }}>DEPARTAMENTO</span>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedEmp.department}</p>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: '0.7rem' }}>CORREO INSTITUCIONAL</span>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedEmp.email}</p>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: '0.7rem' }}>TELÉFONO DE CONTACTO</span>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedEmp.phone}</p>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: '0.7rem' }}>ID OPERATIVO</span>
                  <p style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedEmp.id}</p>
                </div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '10px', color: 'var(--text-muted)' }}>RESUMEN DE PRODUCTIVIDAD</h4>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 100px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--success)' }}>{(selectedEmp.productivity?.completed ?? 0)}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tareas Finalizadas</span>
                  </div>
                  <div style={{ flex: '1 1 100px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--info)' }}>{(selectedEmp.productivity?.active ?? 0)}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Carga de Trabajo Activa</span>
                  </div>
                  <div style={{ flex: '1 1 100px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text)' }}>{(selectedEmp.productivity?.performance ?? 0)}%</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Cumplimiento SLA</span>
                  </div>
                  <div style={{ flex: '1 1 100px', backgroundColor: 'var(--background)', border: '1px solid var(--border)', padding: '12px', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--primary)' }}>{calculateEmployeeResponseTime(selectedEmp.id)}</div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tiem. Respuesta</span>
                  </div>
                </div>
              </div>

              {/* Medallas y Logros de Soporte */}
              {selectedEmp.role !== 'Cliente' && (
                <div>
                  <h4 style={{ fontSize: '0.875rem', marginBottom: '10px', color: 'var(--text-muted)' }}>MEDALLAS Y LOGROS DE SOPORTE</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))', gap: '10px' }}>
                    {getEmployeeAchievements(selectedEmp.id).map(ach => (
                      <div
                        key={ach.id}
                        style={{
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: ach.completed ? 'rgba(239, 182, 172, 0.08)' : 'var(--background)',
                          border: `1px solid ${ach.completed ? 'var(--primary)' : 'var(--border)'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: '4px',
                          opacity: ach.completed ? 1 : 0.45,
                          textAlign: 'center'
                        }}
                      >
                        <span style={{ fontSize: '1.4rem' }}>{ach.title.split(' ')[0]}</span>
                        <strong style={{ fontSize: '0.75rem', color: ach.completed ? 'var(--primary)' : 'var(--text-muted)' }}>
                          {ach.title.substring(ach.title.indexOf(' ') + 1)}
                        </strong>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{ach.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '10px', color: 'var(--text-muted)' }}>TAREAS ASIGNADAS EN PROCESO</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                  {db.projects
                    .flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id })))
                    .filter(t => t.assigneeId === selectedEmp.id && t.status !== 'Completada').length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        Sin tareas asignadas en proceso.
                      </span>
                    ) : (
                      db.projects
                        .flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name, projectId: p.id })))
                        .filter(t => t.assigneeId === selectedEmp.id && t.status !== 'Completada')
                        .map(task => (
                          <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius-xs)', backgroundColor: 'var(--background)' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{task.title}</span>
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Proyecto: {task.projectName}</span>
                            </div>
                            <span className="badge badge-warning" style={{ alignSelf: 'center', fontSize: '0.65rem' }}>{task.status}</span>
                          </div>
                        ))
                    )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button onClick={() => setSelectedEmp(null)} className="btn btn-primary">Entendido</button>
            </div>
        </Modal>
      )}

      {selectedEmp && (
        <div className="print-report-container">
          <div className="print-report-header">
            <div>
              <h1 className="print-report-title">Reporte de Desempeño de Empleado</h1>
              <p style={{ fontSize: '10pt', margin: '4px 0 0 0' }}>JC Enterprise Portal</p>
            </div>
            <div className="print-report-meta">
              <div>Fecha: {new Date().toLocaleDateString()}</div>
              <div>ID Operativo: {selectedEmp.id}</div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">Datos Personales</h2>
            <div className="print-grid">
              <div className="print-field"><strong>Nombre:</strong> {selectedEmp.name}</div>
              <div className="print-field"><strong>Cargo / Rol:</strong> {selectedEmp.role}</div>
              <div className="print-field"><strong>Departamento:</strong> {selectedEmp.department}</div>
              <div className="print-field"><strong>Correo:</strong> {selectedEmp.email}</div>
              <div className="print-field"><strong>Teléfono:</strong> {selectedEmp.phone}</div>
              <div className="print-field"><strong>Estado:</strong> {selectedEmp.status}</div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">Métricas de Productividad</h2>
            <div className="print-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr) !important' }}>
              <div className="print-field" style={{ textAlign: 'center', background: '#f9f9f9', padding: '10px', border: '1px solid #ddd' }}>
                <div style={{ fontSize: '14pt', fontWeight: 500 }}>{(selectedEmp.productivity?.completed ?? 0)}</div>
                <strong>Tareas Logradas</strong>
              </div>
              <div className="print-field" style={{ textAlign: 'center', background: '#f9f9f9', padding: '10px', border: '1px solid #ddd' }}>
                <div style={{ fontSize: '14pt', fontWeight: 500 }}>{(selectedEmp.productivity?.active ?? 0)}</div>
                <strong>Carga Activa</strong>
              </div>
              <div className="print-field" style={{ textAlign: 'center', background: '#f9f9f9', padding: '10px', border: '1px solid #ddd' }}>
                <div style={{ fontSize: '14pt', fontWeight: 500 }}>{(selectedEmp.productivity?.performance ?? 0)}%</div>
                <strong>Cumplimiento SLA</strong>
              </div>
            </div>
          </div>

          <div className="print-section">
            <h2 className="print-section-title">Tareas Asignadas Activas</h2>
            {db.projects
              .flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name })))
              .filter(t => t.assigneeId === selectedEmp.id && t.status !== 'Completada').length === 0 ? (
                <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>No tiene tareas activas en proceso.</p>
              ) : (
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Proyecto</th>
                      <th>Tarea</th>
                      <th>Prioridad</th>
                      <th>Fecha Límite</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {db.projects
                      .flatMap(p => p.tasks.map(t => ({ ...t, projectName: p.name })))
                      .filter(t => t.assigneeId === selectedEmp.id && t.status !== 'Completada')
                      .map((task, idx) => (
                        <tr key={idx}>
                          <td>{task.projectName}</td>
                          <td>{task.title}</td>
                          <td>{task.priority}</td>
                          <td>{task.deadline || 'Sin fecha'}</td>
                          <td>{task.status}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
          </div>

          <div className="print-section">
            <h2 className="print-section-title">Actividades de Agenda</h2>
            {db.agenda.filter(a => a.employeeId === selectedEmp.id).length === 0 ? (
              <p style={{ fontSize: '10pt', fontStyle: 'italic' }}>No hay actividades registrada en su agenda.</p>
            ) : (
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Actividad</th>
                    <th>Tipo</th>
                    <th>Cliente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {db.agenda
                    .filter(a => a.employeeId === selectedEmp.id)
                    .map((act, idx) => (
                      <tr key={idx}>
                        <td>{act.date}</td>
                        <td>{act.time}</td>
                        <td>{act.title}</td>
                        <td>{act.type}</td>
                        <td>{act.clientName || 'Interno'}</td>
                        <td>{act.status}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

