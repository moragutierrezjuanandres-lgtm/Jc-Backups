import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Projects() {
  const {
    db,
    addProject,
    deleteProject,
    updateProjectStatus,
    updateProjectPriority,
    addTaskToProject,
    updateTaskStatus,
    deleteTaskFromProject,
    updateTaskFields,
    addCommentToTask,
    logTaskHours,
    addProjectAnnotation,
    currentUser
  } = useContext(AppContext);

  const [selectedProj, setSelectedProj] = useState(null);
  const [viewMode, setViewMode] = useState('kanban'); // 'kanban' or 'list'
  const [selectedTask, setSelectedTask] = useState(null); // Active task for details modal

  // Forms states
  const [showAddProject, setShowAddProject] = useState(false);
  const [projName, setProjName] = useState('');
  const [projClient, setProjClient] = useState('');
  const [projClientSearch, setProjClientSearch] = useState('');
  const [projLead, setProjLead] = useState('');
  const [projPriority, setProjPriority] = useState('Media');
  const [projStart, setProjStart] = useState('');
  const [projEnd, setProjEnd] = useState('');

  const [showAddTask, setShowAddTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDeadline, setTaskDeadline] = useState('');
  const [taskPriority, setTaskPriority] = useState('Media');

  const [newComment, setNewComment] = useState('');
  const [logHours, setLogHours] = useState('');
  const [annotationText, setAnnotationText] = useState('');

  const [projectTab, setProjectTab] = useState('active'); // 'active' or 'closed' (closed is ONLY for emp-master!)

  if (!db) return null;

  const isCliente = currentUser?.role === 'Cliente';
  const isMasterUser = currentUser?.id === 'emp-master';
  const isMasterOrAdmin = currentUser?.id === 'emp-master' || currentUser?.role === 'Administrador';
  const isMaster = currentUser?.id === 'emp-master' || currentUser?.role === 'Administrador';

  const allProjects = isCliente
    ? (db.projects || []).filter(p => p && p.clientId === currentUser.clientId)
    : (db.projects || []);

  const activeProjects = allProjects.filter(p => p && p.status !== 'Cerrado');
  const closedProjects = allProjects.filter(p => p && p.status === 'Cerrado');

  const currentTabProjects = projectTab === 'closed' ? closedProjects : activeProjects;
  
  const project = (selectedProj && allProjects.some(p => p && p.id === selectedProj.id))
    ? (db.projects.find(p => p && p.id === selectedProj.id) || selectedProj)
    : currentTabProjects[0];

  // Drag and Drop handlers
  const handleDragStart = (e, taskId) => {
    e.dataTransfer.setData('text/plain', taskId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    if (taskId && project) {
      updateTaskStatus(project.id, taskId, newStatus);
      
      // Update local state copy to render progress changes instantly
      const updatedProj = db.projects.find(p => p.id === project.id);
      setSelectedProj(updatedProj);
    }
  };

  // Submit new project
  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!projName || !projClient) return;

    const clientObj = db.clients.find(c => c.id === projClient);
    const leadObj = db.employees.find(emp => emp.id === projLead);

    addProject({
      name: projName,
      clientId: projClient,
      clientName: clientObj ? clientObj.commercialName : 'Interno',
      leadId: projLead,
      leadName: leadObj ? leadObj.name : 'Sin asignar',
      startDate: projStart || new Date().toISOString().split('T')[0],
      endDate: projEnd || '',
      priority: projPriority,
      status: 'Planificado'
    });

    setProjName('');
    setProjStart('');
    setProjEnd('');
    setProjClientSearch('');
    setShowAddProject(false);
  };

  // Submit new task
  const handleCreateTask = (e) => {
    e.preventDefault();
    if (!taskTitle || !project) return;

    const assigneeObj = db.employees.find(emp => emp.id === taskAssignee);

    addTaskToProject(project.id, {
      title: taskTitle,
      description: taskDesc,
      assigneeId: taskAssignee,
      assigneeName: assigneeObj ? assigneeObj.name : 'Sin Asignar',
      deadline: taskDeadline,
      priority: taskPriority,
      status: 'Pendiente'
    });

    setTaskTitle('');
    setTaskDesc('');
    setTaskDeadline('');
    setShowAddTask(false);

    // Refresh project details
    const updatedProj = db.projects.find(p => p.id === project.id);
    setSelectedProj(updatedProj);
  };

  // Comment submit
  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim() || !project || !selectedTask) return;

    addCommentToTask(project.id, selectedTask.id, newComment);
    setNewComment('');
    
    // Refresh modal info
    const updatedProj = db.projects.find(p => p.id === project.id);
    setSelectedProj(updatedProj);
    const updatedTask = updatedProj.tasks.find(t => t.id === selectedTask.id);
    setSelectedTask(updatedTask);
  };

  // Log hours on task
  const handleLogHoursSubmit = (e) => {
    e.preventDefault();
    const hours = parseFloat(logHours);
    if (isNaN(hours) || hours <= 0 || !project || !selectedTask) return;

    logTaskHours(project.id, selectedTask.id, hours);
    setLogHours('');
    
    // Refresh modal info
    const updatedProj = db.projects.find(p => p.id === project.id);
    if (updatedProj) {
      const updatedTask = updatedProj.tasks.find(t => t.id === selectedTask.id);
      setSelectedProj(updatedProj);
      setSelectedTask(updatedTask);
    }
  };

  const handleAddAnnotation = (e) => {
    e.preventDefault();
    if (!annotationText.trim() || !project) return;

    addProjectAnnotation(project.id, annotationText);
    setAnnotationText('');

    // Refresh project details
    const updatedProj = db.projects.find(p => p.id === project.id);
    setSelectedProj(updatedProj);
  };

  return (
    <div className="page-container" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="page-heading"><div><span className="eyebrow">GESTIÓN</span><h1>Proyectos</h1><p className="muted">Planifica tareas, asigna responsables y da seguimiento a cada entrega.</p></div></div>
      
      {/* Top Tab Selector for Master / Admins */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className={`btn ${projectTab === 'active' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setProjectTab('active')}
            style={{ padding: '8px 16px', fontWeight: 500 }}
          >
             Proyectos Activos ({activeProjects.length})
          </button>

          {isMasterUser && (
            <button
              type="button"
              className={`btn ${projectTab === 'closed' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setProjectTab('closed')}
              style={{ padding: '8px 16px', fontWeight: 500, backgroundColor: projectTab === 'closed' ? 'var(--secondary)' : undefined }}
            >
               Historial de Proyectos Cerrados ({closedProjects.length})
              <span className="badge badge-warning" style={{ fontSize: '0.65rem', marginLeft: '6px' }}>Exclusivo Master</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW 1: MASTER CLOSED PROJECTS HISTORY */}
      {projectTab === 'closed' && isMasterUser ? (
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text)' }}>
               Historial de Proyectos Cerrados y Archivados
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
              Bitácora confidencial de proyectos finalizados. Solo visible para el Usuario Maestro ({currentUser.name}).
            </p>
          </div>

          <div className="table-wrapper">
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Proyecto</th>
                  <th>Cliente</th>
                  <th>Líder</th>
                  <th>Fecha Inicio</th>
                  <th>Fecha de Cierre</th>
                  <th>Progreso</th>
                  <th>Horas Registradas</th>
                  <th style={{ textAlign: 'center' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {closedProjects.map(p => {
                  const totalHrs = (p.tasks || []).reduce((sum, t) => sum + (t.hoursLogged || 0), 0);
                  return (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500, color: 'var(--primary)' }}>{p.name}</td>
                      <td>{p.clientName}</td>
                      <td>{p.leadName}</td>
                      <td>{p.startDate || 'N/A'}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {p.closedAt ? p.closedAt.substring(0, 10) : (p.endDate || 'N/A')}
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ fontWeight: 500 }}>{p.progress}%</span>
                      </td>
                      <td><strong>{totalHrs} hrs</strong></td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            updateProjectStatus(p.id, 'En proceso');
                            setProjectTab('active');
                          }}
                          style={{ padding: '4px 10px', fontSize: '0.75rem', fontWeight: 500 }}
                          title="Reabrir proyecto y devolverlo al tablero activo"
                        >
                           Reabrir Proyecto
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {closedProjects.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                      No hay proyectos cerrados o archivados en el historial actualmente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* VIEW 2: ACTIVE PROJECTS KANBAN & LIST */
        <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '24px' }}>
        
        {/* Left Project Selector Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!isCliente && (
            <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => setShowAddProject(true)} 
                style={{ width: '100%' }}
                title="Crear un nuevo proyecto en el sistema, definiendo el cliente, fechas límites e integrantes"
              >
                + Nuevo Proyecto
              </button>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '60vh', overflowY: 'auto' }}>
            {activeProjects.map(p => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProj(p);
                  setSelectedTask(null);
                }}
                style={{
                  padding: '12px 16px',
                  backgroundColor: project && project.id === p.id ? 'var(--primary-glow)' : 'var(--card)',
                  border: `1px solid ${project && project.id === p.id ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                title={`Ver tablero, lista de tareas y bitácora del proyecto: ${p.name}`}
              >
                <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>{p.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{p.clientName}</span>
                  <span style={{ fontWeight: 500 }}>{p.progress}%</span>
                </div>
              </div>
            ))}
            {activeProjects.length === 0 && (
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay proyectos activos.</span>
            )}
          </div>
        </div>

        {/* Right Active Project Details View */}
        {project && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Project Banner Card */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '6px' }}>Prioridad: {project.priority}</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.02em' }}>{project.name}</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Cliente: <strong>{project.clientName}</strong> | Líder: <strong>{project.leadName}</strong></p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button 
                    onClick={() => setViewMode('kanban')} 
                    className={`btn ${viewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    title="Tablero Kanban: Visualiza y organiza las tareas en columnas de flujo de trabajo"
                  >
                    Kanban
                  </button>
                  <button 
                    onClick={() => setViewMode('list')} 
                    className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                    title="Vista de Lista: Mira todas las tareas del proyecto listadas en formato secuencial"
                  >
                    Lista
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Prioridad:</span>
                    <select
                      value={project.priority}
                      onChange={(e) => {
                        updateProjectPriority(project.id, e.target.value);
                        const updated = db.projects.find(p => p.id === project.id);
                        setSelectedProj(updated);
                      }}
                      className="form-select"
                      style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                      disabled={isCliente}
                      title="Cambiar la prioridad asignada a este proyecto"
                    >
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estado:</span>
                    {(!isCliente || project.status !== 'Completado') ? (
                      <select
                        value={project.status}
                        onChange={(e) => {
                          updateProjectStatus(project.id, e.target.value);
                          const updated = db.projects.find(p => p.id === project.id);
                          setSelectedProj(updated);
                        }}
                        className="form-select"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                        title="Cambiar el estado actual de ejecución del proyecto"
                      >
                        {isCliente ? (
                          <>
                            {project.status !== 'Cancelado' && project.status !== 'Pospuesto' && (
                              <option value={project.status}>{project.status}</option>
                            )}
                            <option value="Cancelado">Cancelado</option>
                            <option value="Pospuesto">Pospuesto</option>
                          </>
                        ) : (
                          <>
                            <option value="Planificado">Planificado</option>
                            <option value="En proceso">En proceso</option>
                            <option value="En revisión">En revisión</option>
                            <option value="Completado">Completado</option>
                            <option value="Cancelado">Cancelado</option>
                            <option value="Pospuesto">Pospuesto</option>
                            <option value="Cerrado"> Cerrado / Archivado</option>
                          </>
                        )}
                      </select>
                    ) : (
                      <span className="badge badge-success" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>{project.status}</span>
                    )}

                    {isMasterUser && (
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          if (window.confirm(`¿Está seguro de que desea ELIMINAR DEFINITIVAMENTE el proyecto "${project.name}"? Esta acción no se puede deshacer.`)) {
                            deleteProject(project.id);
                            setSelectedProj(null);
                          }
                        }}
                        style={{ padding: '6px 12px', fontSize: '0.75rem', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        title="Eliminar este proyecto permanentemente (Exclusivo Master)"
                      >
                         Eliminar Proyecto
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Kanban Mode */}
            {viewMode === 'kanban' ? (
              <div style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '16px' }}>
                {['Pendiente', 'En proceso', 'Bloqueada', 'Completada'].map(colStatus => {
                  const tasks = project.tasks.filter(t => t.status === colStatus);
                  return (
                    <div
                      key={colStatus}
                      className="kanban-column"
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, colStatus)}
                    >
                      <div className="kanban-header">
                        <div className="kanban-title">
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            borderRadius: '50%', 
                            backgroundColor: colStatus === 'Pendiente' ? 'var(--text-muted)' : 
                                            colStatus === 'En proceso' ? 'var(--info)' : 
                                            colStatus === 'Bloqueada' ? 'var(--danger)' : 'var(--success)'
                          }}></span>
                          {colStatus}
                        </div>
                        <span className="kanban-count">{tasks.length}</span>
                      </div>
                      
                      <div className="kanban-cards-wrapper">
                        {tasks.map(task => (
                          <div
                            key={task.id}
                            className="kanban-card"
                            draggable={!isCliente}
                            onDragStart={(e) => !isCliente && handleDragStart(e, task.id)}
                            onClick={() => setSelectedTask(task)}
                            style={{
                              position: 'relative',
                              borderLeft: `4px solid ${
                                task.priority === 'Urgente' ? 'var(--danger)' :
                                task.priority === 'Alta' ? 'var(--warning)' :
                                task.priority === 'Media' ? 'var(--info)' : 'var(--text-muted)'
                              }`
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                              <div className="kanban-card-title" style={{ flex: 1, fontSize: '0.85rem' }}>{task.title}</div>
                              {isMaster && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (window.confirm('¿Está seguro de que desea eliminar esta tarea?')) {
                                      deleteTaskFromProject(project.id, task.id);
                                      const updatedProj = db.projects.find(p => p.id === project.id);
                                      setSelectedProj(updatedProj);
                                      if (selectedTask && selectedTask.id === task.id) {
                                        setSelectedTask(null);
                                      }
                                    }
                                  }}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem',
                                    padding: '2px',
                                    marginTop: '-2px',
                                    marginRight: '-4px',
                                    opacity: 0.7,
                                    transition: 'all var(--transition-fast)'
                                  }}
                                  title="Eliminar tarea"
                                  onMouseEnter={(e) => { e.target.style.color = 'var(--danger)'; e.target.style.opacity = 1; }}
                                  onMouseLeave={(e) => { e.target.style.color = 'var(--text-muted)'; e.target.style.opacity = 0.7; }}
                                >
                                  🗑️
                                </button>
                              )}
                            </div>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {task.description}
                            </p>
                            <div className="kanban-card-meta">
                              <span style={{ fontWeight: 500 }}>👤 {task.assigneeName}</span>
                              <span className={`badge ${task.priority === 'Urgente' ? 'badge-danger' : task.priority === 'Alta' ? 'badge-warning' : 'badge-primary'}`} style={{ fontSize: '0.65rem' }}>
                                {task.priority}
                              </span>
                            </div>
                            {task.status === 'Completada' && task.completedByName && (
                              <div style={{ fontSize: '0.65rem', color: 'var(--success)', marginTop: '4px', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>✓ Finalizado por:</span>
                                <strong>{task.completedByName}</strong>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {colStatus === 'Pendiente' && !isCliente && (
                        <button 
                          className="btn btn-secondary" 
                          onClick={() => setShowAddTask(true)}
                          style={{ margin: '12px', borderStyle: 'dashed', fontSize: '0.75rem', padding: '8px' }}
                        >
                          + Añadir Tarea
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List Mode */
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ fontSize: '1rem' }}>Lista de Tareas</h3>
                  {!isCliente && (
                    <button className="btn btn-primary" onClick={() => setShowAddTask(true)} style={{ padding: '6px 12px', fontSize: '0.75rem' }}>
                      + Añadir Tarea
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {project.tasks.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>No hay tareas creadas.</span>
                  ) : (
                    project.tasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTask(task)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px 16px',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
                          backgroundColor: 'var(--background)',
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ 
                            width: '10px', 
                            height: '10px', 
                            borderRadius: '50%', 
                            backgroundColor: task.status === 'Completada' ? 'var(--success)' : 'var(--warning)'
                          }}></span>
                          <div>
                            <div style={{ fontSize: '0.875rem', fontWeight: 500, textDecoration: task.status === 'Completada' ? 'line-through' : 'none' }}>
                              {task.title}
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginTop: '2px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Asignado: {task.assigneeName} | Fecha Límite: {task.deadline || 'Sin fecha'}
                              </span>
                              {task.status === 'Completada' && task.completedByName && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--success)', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>| Finalizado por:</span>
                                  <strong>{task.completedByName}</strong>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} onClick={(e) => e.stopPropagation()}>
                          <span className="badge badge-info">{task.status}</span>
                          <span className="badge badge-primary">{task.priority}</span>
                          {isMaster && (
                            <button
                              onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('¿Está seguro de que desea eliminar esta tarea?')) {
                                    deleteTaskFromProject(project.id, task.id);
                                    const updatedProj = db.projects.find(p => p.id === project.id);
                                    setSelectedProj(updatedProj);
                                    if (selectedTask && selectedTask.id === task.id) {
                                      setSelectedTask(null);
                                    }
                                  }
                              }}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                                padding: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color var(--transition-fast)'
                              }}
                              title="Eliminar tarea"
                              onMouseEnter={(e) => e.target.style.color = 'var(--danger)'}
                              onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Annotations & Progress Updates (Bitácora) */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '8px', fontWeight: 600 }}>
                 Bitácora de Avances y Anotaciones del Proyecto
              </h3>
              
              {!isCliente && (
                <form onSubmit={handleAddAnnotation} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Agregar una anotación técnica o reporte de avance..."
                    className="form-input"
                    value={annotationText}
                    onChange={(e) => setAnnotationText(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary" style={{ minWidth: '120px' }}>Guardar Nota</button>
                </form>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
                {!project.annotations || project.annotations.length === 0 ? (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                    No hay anotaciones registradas en este proyecto.
                  </span>
                ) : (
                  project.annotations.map(ann => (
                    <div key={ann.id} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 500, color: 'var(--primary)' }}>👤 {ann.user}</span>
                        <span>{ann.timestamp}</span>
                      </div>
                      <span style={{ fontSize: '0.875rem', color: 'var(--text)' }}>{ann.content}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    )}

      {/* ================= MODAL: TASK DETAIL & INTERACTION ================= */}
      {selectedTask && (
        <Modal onClose={() => setSelectedTask(null)} maxWidth="600px">
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span className="badge badge-primary" style={{ marginRight: '6px' }}>{selectedTask.priority}</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>ID: {selectedTask.id}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {isMaster && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      if (window.confirm('¿Está seguro de que desea eliminar esta tarea?')) {
                        deleteTaskFromProject(project.id, selectedTask.id);
                        const updatedProj = db.projects.find(p => p.id === project.id);
                        setSelectedProj(updatedProj);
                        setSelectedTask(null);
                      }
                    }}
                    style={{ padding: '6px 12px', minWidth: 'auto', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                    title="Eliminar tarea"
                  >
                     Eliminar
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setSelectedTask(null)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
              </div>
            </div>
            
            <div className="modal-body">
              <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>{selectedTask.title}</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', backgroundColor: 'var(--background)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
                {selectedTask.description || 'Sin descripción.'}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', fontSize: '0.8125rem' }}>
                <div><strong>Asignado a:</strong> {selectedTask.assigneeName}</div>
                <div><strong>Fecha Límite:</strong> {selectedTask.deadline || 'Sin fecha'}</div>
                <div><strong>Horas Trabajadas:</strong> {selectedTask.timeSpent} hrs</div>
                <div>
                  <strong>Estado:</strong>
                  <select
                    value={selectedTask.status}
                    onChange={(e) => {
                      updateTaskStatus(project.id, selectedTask.id, e.target.value);
                      const updatedProj = db.projects.find(p => p.id === project.id);
                      setSelectedProj(updatedProj);
                      setSelectedTask(updatedProj.tasks.find(t => t.id === selectedTask.id));
                    }}
                    className="form-select"
                    style={{ padding: '4px 8px', fontSize: '0.75rem', width: 'auto', marginLeft: '8px' }}
                  >
                    <option value="Pendiente">Pendiente</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Bloqueada">Bloqueada</option>
                    <option value="Completada">Completada</option>
                  </select>
                </div>
                {selectedTask.status === 'Completada' && (
                  <div style={{ gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '6px' }}>
                    <strong>Finalizada por:</strong>
                    <select
                      value={selectedTask.completedByName || ''}
                      onChange={(e) => {
                        updateTaskFields(project.id, selectedTask.id, { completedByName: e.target.value });
                        const updatedProj = db.projects.find(p => p.id === project.id);
                        setSelectedProj(updatedProj);
                        setSelectedTask(updatedProj.tasks.find(t => t.id === selectedTask.id));
                      }}
                      className="form-select"
                      style={{ padding: '6px 12px', fontSize: '0.8125rem', width: 'auto' }}
                    >
                      <option value="">Seleccione quién finalizó...</option>
                      {db.employees.map(emp => (
                        <option key={emp.id} value={emp.name}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Log Hours Form */}
              <form onSubmit={handleLogHoursSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Registrar Tiempo Invertido (Horas)</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="ej. 2.5"
                    className="form-input"
                    value={logHours}
                    onChange={e => setLogHours(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-secondary">Cargar Horas</button>
              </form>

              {/* Comments Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <h4 style={{ fontSize: '0.875rem', marginBottom: '8px' }}>Conversación y Bitácora</h4>
                
                {/* List of comments */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '180px', overflowY: 'auto', marginBottom: '12px' }}>
                  {selectedTask.comments && selectedTask.comments.length === 0 ? (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay comentarios.</span>
                  ) : (
                    selectedTask.comments && selectedTask.comments.map(c => (
                      <div key={c.id} style={{ display: 'flex', flexDirection: 'column', backgroundColor: 'var(--background)', padding: '8px 12px', borderRadius: 'var(--radius-xs)', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px' }}>
                          <span style={{ fontWeight: 500, color: 'var(--primary)' }}>{c.user}</span>
                          <span>{c.time}</span>
                        </div>
                        <span style={{ fontSize: '0.8125rem' }}>{c.content}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Comment input form */}
                <form onSubmit={handleAddComment} style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Escriba un comentario o reporte de avance..."
                    className="form-input"
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                  />
                  <button type="submit" className="btn btn-primary">Enviar</button>
                </form>
              </div>
            </div>
        </Modal>
      )}

      {/* ================= MODAL: ADD PROJECT ================= */}
      {showAddProject && (
        <Modal onClose={() => { setShowAddProject(false); setProjClientSearch(''); }}>
            <div className="modal-header">
              <h3>Crear Nuevo Proyecto</h3>
              <button className="btn btn-secondary" onClick={() => { setShowAddProject(false); setProjClientSearch(''); }} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleCreateProject}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Nombre del Proyecto</label>
                  <input type="text" className="form-input" required value={projName} onChange={e => setProjName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cliente Asociado</label>
                  <input
                    type="text"
                    placeholder="🔍 Buscar cliente..."
                    className="form-input"
                    value={projClientSearch}
                    onChange={e => setProjClientSearch(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <select className="form-select" required value={projClient} onChange={e => setProjClient(e.target.value)}>
                    <option value="">Seleccione cliente...</option>
                    {db.clients
                      .filter(c => c.commercialName.toLowerCase().includes(projClientSearch.toLowerCase()))
                      .sort((a, b) => a.commercialName.localeCompare(b.commercialName, 'es', { sensitivity: 'base' }))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.commercialName}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Responsable / Líder del Proyecto</label>
                  <select className="form-select" required value={projLead} onChange={e => setProjLead(e.target.value)}>
                    <option value="">Seleccione empleado...</option>
                    {db.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Prioridad</label>
                  <select className="form-select" value={projPriority} onChange={e => setProjPriority(e.target.value)}>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha de Inicio</label>
                  <input type="date" className="form-input" value={projStart} onChange={e => setProjStart(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha Límite Estimada</label>
                  <input type="date" className="form-input" value={projEnd} onChange={e => setProjEnd(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddProject(false); setProjClientSearch(''); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Iniciar Proyecto</button>
              </div>
            </form>
        </Modal>
      )}

      {/* ================= MODAL: ADD TASK ================= */}
      {showAddTask && (
        <Modal onClose={() => setShowAddTask(false)}>
            <div className="modal-header">
              <h3>Crear Nueva Tarea</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddTask(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título de Tarea</label>
                  <input type="text" className="form-input" required value={taskTitle} onChange={e => setTaskTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción</label>
                  <textarea rows="3" className="form-textarea" value={taskDesc} onChange={e => setTaskDesc(e.target.value)}></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label">Asignado a</label>
                  <select className="form-select" required value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)}>
                    <option value="">Seleccione responsable...</option>
                    {db.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Prioridad</label>
                  <select className="form-select" value={taskPriority} onChange={e => setTaskPriority(e.target.value)}>
                    <option value="Baja">Baja</option>
                    <option value="Media">Media</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Fecha Límite</label>
                  <input type="date" className="form-input" value={taskDeadline} onChange={e => setTaskDeadline(e.target.value)} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddTask(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Asignar Tarea</button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
