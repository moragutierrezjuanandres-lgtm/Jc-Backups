import React, { createContext, useState, useEffect, useRef } from 'react';
import { api } from '../utils/api';
import { changesBetween, applyChanges } from '../utils/changes';
import { playBellSound } from '../utils/audio';

const defaultFields = {
  employees: [],
  clients: [],
  projects: [],
  agenda: [],
  weeklyGoals: [],
  tickets: [],
  knowledgeBase: [],
  utilitarios: [],
  referrals: [],
  notifications: [],
  auditLogs: [],
  a2Categories: [],
  a2Reports: [],
  serviceReports: [],
  backups: []
};

export function sanitizeDb(rawDb) {
  if (!rawDb) return null;
  const sanitized = { ...defaultFields, ...rawDb };
  for (const key of Object.keys(defaultFields)) {
    if (!Array.isArray(sanitized[key])) {
      sanitized[key] = [];
    }
  }
  // Sanitizar artículos de la wiki para asegurar compatibilidad de datos existentes
  if (Array.isArray(sanitized.knowledgeBase)) {
    sanitized.knowledgeBase = sanitized.knowledgeBase.map(item => {
      let tags = item.tags;
      if (typeof tags === 'string') {
        tags = tags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      } else if (!Array.isArray(tags)) {
        tags = [];
      }
      return {
        ...item,
        tags,
        errorCode: item.errorCode || ''
      };
    });
  }

  // Sanitizar utilitarios
  if (!Array.isArray(sanitized.utilitarios)) {
    sanitized.utilitarios = [];
  }

  // Auto-actualizar permisos para utilitarios si tienen acceso a wiki
  if (Array.isArray(sanitized.employees)) {
    sanitized.employees = sanitized.employees.map(emp => {
      if (emp.allowedSections && emp.allowedSections.includes('wiki') && !emp.allowedSections.includes('utilitarios')) {
        emp.allowedSections = [...emp.allowedSections, 'utilitarios'];
      }
      return emp;
    });
  }

  // Sanitizar servidores de clientes para asegurar que todos tengan un ID único
  if (Array.isArray(sanitized.clients)) {
    sanitized.clients = sanitized.clients.map(client => {
      if (client.infrastructure && Array.isArray(client.infrastructure.servers)) {
        client.infrastructure.servers = client.infrastructure.servers.map((srv, idx) => {
          if (!srv.id) {
            srv.id = `srv-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`;
          }
          return srv;
        });
      }
      return client;
    });
  }
  
  // Inicializar categorías y reportes A2 por defecto si están vacíos
  if (!sanitized.a2Categories || sanitized.a2Categories.length === 0) {
    sanitized.a2Categories = [
      { id: 'cat-1', name: 'Fiscal' },
      { id: 'cat-2', name: 'Ventas' },
      { id: 'cat-3', name: 'Inventario' },
      { id: 'cat-4', name: 'Caja' },
      { id: 'cat-5', name: 'Seguridad' }
    ];
  }
  if (!sanitized.ticketCategories || sanitized.ticketCategories.length === 0) {
    sanitized.ticketCategories = [
      'Soporte de Software',
      'Impresora Fiscal',
      'Infraestructura',
      'Bases de Datos',
      'Redes / Conectividad',
      'Consultoría ERP'
    ];
  }
  if (!sanitized.a2Reports || sanitized.a2Reports.length === 0) {
    sanitized.a2Reports = [
      {
        id: 'rep-1',
        title: 'Libro de Ventas Fiscal (IVA)',
        description: 'Libro de ventas formateado según requerimientos del SENIAT, agrupado por tipo de contribuyente y alícuotas.',
        utility: 'Permite generar de manera exacta el formato legal de ventas exigido por el fisco (SENIAT) para la declaración de impuestos.',
        categoryId: 'cat-1',
        sqlQuery: 'SELECT F_FECHADOCC AS Fecha, F_DOCUMENTO AS Factura, F_RIF AS RIF, F_NETO AS Neto FROM SFACTURA ORDER BY F_FECHADOCC;',
        files: []
      },
      {
        id: 'rep-2',
        title: 'Existencia Valorada de Inventario',
        description: 'Reporte de stock actual valorado a costo promedio y costo último de reposición.',
        utility: 'Ayuda a auditar el valor monetario de las existencias físicas en el almacén para análisis de activos corrientes de la empresa.',
        categoryId: 'cat-3',
        sqlQuery: 'SELECT FI_CODIGO, FI_DESCRIPCION, FI_EXISTENCIA, FI_COSTOPROM, (FI_EXISTENCIA * FI_COSTOPROM) AS Valor_Promedio FROM SINVENTARIO WHERE FI_EXISTENCIA > 0 ORDER BY FI_DESCRIPCION;',
        files: []
      },
      {
        id: 'rep-3',
        title: 'Ventas por Vendedor con Comisión',
        description: 'Consolidado de facturación por vendedor calculando comisión según cobros.',
        utility: 'Determina las ventas realizadas por cada vendedor para liquidar sus comisiones de forma transparente al final del mes.',
        categoryId: 'cat-2',
        sqlQuery: 'SELECT v.F_DESCRIPCION AS Vendedor, SUM(f.F_NETO) AS Total_Neto FROM SFACTURA f INNER JOIN SVENDEDOR v ON f.F_CODVENDEDOR = v.F_CODIGO GROUP BY v.F_DESCRIPCION;',
        files: []
      }
    ];
  }
  return sanitized;
}

export const AppContext = createContext();

export const getApiUrl = endpoint => endpoint;

export function AppProvider({ children }) {
  const [db, setDb] = useState(null);
  const [loading, setLoading] = useState(true);
  const [splashDone, setSplashDone] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const t = params.get('tab');
      if (t) {
        if (t === 'backups') return 'backups';
        return t;
      }
    } catch (e) {}
    return 'dashboard';
  });
  const [theme, setTheme] = useState('light');
  const [pendingTicket, setPendingTicket] = useState(null);
  const [saveError, setSaveError] = useState('');
  const dbRef = useRef(null);
  const queueRef = useRef(Promise.resolve());
  const pendingRef = useRef(0);
  const generationRef = useRef(0);
  const lastWriteTimeRef = useRef(0);
  const lastLoadedModifiedRef = useRef(0);
  const notifications = db && currentUser
    ? (db.notifications || []).filter(n => !n.recipientId || n.recipientId === currentUser.id)
    : [];


  // Only authenticated server data is loaded; browser storage is not a database.
  useEffect(() => {
    localStorage.removeItem('jc_enterprise_db_data');
    api('/api/auth/session').then(result => {
      const data=sanitizeDb(result.db); dbRef.current=data;setDb(data);
      setCurrentUser(result.user);setIsAuthenticated(true);lastLoadedModifiedRef.current=result.revision;
    }).catch(() => {}).finally(()=>setLoading(false));
  }, []);

  // Show splash for at least 2.5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setSplashDone(true);
    }, 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if(!isAuthenticated) return;
    const timer=setInterval(async()=>{
      if(pendingRef.current) return;
      try {const status=await api('/api/db/status');if(status.lastModified!==lastLoadedModifiedRef.current) await refreshDatabase();}
      catch(e) { if(e.status===401) {setIsAuthenticated(false);setCurrentUser(null);setDb(null);dbRef.current=null;} }
    },5000);
    return ()=>clearInterval(timer);
  },[isAuthenticated]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const notifiedItems = useRef(new Set());

  // Background check for pending items every 60 seconds
  useEffect(() => {
    if (!isAuthenticated || !db) return;

    const runChecks = () => {
      const now = new Date();
      const todayStr = now.getFullYear() + '-' + 
        String(now.getMonth() + 1).padStart(2, '0') + '-' + 
        String(now.getDate()).padStart(2, '0');

      // 1. Tareas vencidas
      (db.projects || []).forEach(proj => {
        (proj.tasks || []).forEach(t => {
          if (t.status !== 'Completada' && t.deadline) {
            const dl = new Date(t.deadline);
            if (dl < now) {
              const key = `task-overdue-${t.id}`;
              if (!notifiedItems.current.has(key)) {
                notifiedItems.current.add(key);
                addNotification(`⚠️ Tarea vencida: "${t.title}" en proyecto ${proj.name}`);
              }
            }
          }
        });
      });

      // 2. Tickets abiertos > 72h
      (db.tickets || []).forEach(t => {
        if (t.status !== 'Cerrado' && t.createdAt) {
          const created = new Date(t.createdAt.replace(' ', 'T'));
          const diffMs = now - created;
          const diffHours = diffMs / (1000 * 60 * 60);
          if (diffHours > 72) {
            const key = `ticket-aged-${t.id}`;
            if (!notifiedItems.current.has(key)) {
              notifiedItems.current.add(key);
              addNotification(`⏰ Ticket envejecido: ${t.id} ("${t.title}") lleva más de 72h abierto`);
            }
          }
        }
      });

      // 3. Agenda de hoy pendiente
      (db.agenda || []).forEach(act => {
        if (act.status === 'Pendiente' && act.date === todayStr) {
          const key = `agenda-today-${act.id}`;
          if (!notifiedItems.current.has(key)) {
            notifiedItems.current.add(key);
            addNotification(`📅 Actividad de agenda hoy: "${act.title}"`);
          }
        }
      });

      // 4. Inactividad de soporte de clientes normales (>30 días sin tickets)
      (db.clients || []).forEach(client => {
        const type = client.clientType || 'Normal';
        if (type === 'Normal' && client.status === 'Activo') {
          const clientTickets = (db.tickets || []).filter(t => t.clientId === client.id);
          let daysInactive = 0;
          let hasRecent = false;
          
          if (clientTickets.length > 0) {
            const dates = clientTickets.map(t => {
              const dStr = t.createdAt ? t.createdAt.replace(' ', 'T') : null;
              return dStr ? new Date(dStr) : new Date(0);
            });
            const maxDate = new Date(Math.max(...dates));
            const diffMs = now - maxDate;
            daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            if (daysInactive > 30) {
              hasRecent = true;
            }
          } else {
            const startStr = client.contractStart;
            if (startStr) {
              const startDate = new Date(startStr);
              const diffMs = now - startDate;
              daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
              if (daysInactive > 30) {
                hasRecent = true;
              }
            } else {
              const regTimestamp = parseInt(client.id.replace('cli-', ''), 10);
              if (!isNaN(regTimestamp)) {
                const diffMs = now - new Date(regTimestamp);
                daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (daysInactive > 30) {
                  hasRecent = true;
                }
              }
            }
          }

          if (hasRecent) {
            const key = `client-inactive-${client.id}-${daysInactive}`;
            if (!notifiedItems.current.has(key)) {
              notifiedItems.current.add(key);
              addNotification(`⚠️ Inactividad: El cliente "${client.commercialName}" no ha generado tickets desde hace ${daysInactive} días. Realice un seguimiento.`);
            }
          }
        }
      });
    };

    // Run once on load, then every 60s
    runChecks();
    const interval = setInterval(runChecks, 60000);
    return () => clearInterval(interval);
  }, [isAuthenticated, db]);

  const logActivity = (action, details, userObject=currentUser, dbState=null) => dbState || db;
  const updateDbState = (newDbData, baseline=db) => {
    const changes=changesBetween(baseline || {},newDbData);
    if(!changes.length) return Promise.resolve(true);
    const optimistic=applyChanges(dbRef.current || baseline,changes);
    dbRef.current=optimistic;setDb(optimistic);setSaveError('');pendingRef.current++;
    const generation=generationRef.current;
    const operation=queueRef.current.then(async()=>{
      if(generation!==generationRef.current) {pendingRef.current--;return false;}
      try {
        const result=await api('/api/db',{method:'PATCH',body:{changes}});
        lastLoadedModifiedRef.current=result.revision;
        if(pendingRef.current===1) {const fresh=sanitizeDb(result.db);dbRef.current=fresh;setDb(fresh);}
        return true;
      } catch(e) {
        generationRef.current++;
        setSaveError(e.message + ' Los cambios no guardados se descartaron; revisa el registro antes de repetir la operación.');
        await refreshDatabase();return false;
      } finally {pendingRef.current--;}
    });
    queueRef.current=operation.catch(()=>false);
    return operation;
  };
  const login = async (username,password) => {
    try {const result=await api('/api/auth/login',{method:'POST',body:{username,password}});const data=sanitizeDb(result.db);dbRef.current=data;setDb(data);setCurrentUser(result.user);setIsAuthenticated(true);lastLoadedModifiedRef.current=result.revision;return {success:true,user:result.user};}
    catch(e) {return {success:false,error:e.message};}
  };
  const logout = async () => {
    await queueRef.current;
    try {await api('/api/auth/logout',{method:'POST',body:{}});} catch {}
    generationRef.current++;dbRef.current=null;setDb(null);setCurrentUser(null);setIsAuthenticated(false);setActiveTab('dashboard');
  };
  const changeUserRole = () => {setSaveError('Para cambiar de cuenta debes cerrar sesión e iniciar con sus credenciales.');};
  const addNotification = (text,recipientId=null) => {
    const current=dbRef.current;if(!current || currentUser?.role==='Cliente') return;
    if((current.notifications||[]).some(n=>n.text===text && n.recipientId===recipientId)) return;
    const item={id:crypto.randomUUID?.() || 'notif-'+Date.now()+'-'+Math.random(),text,recipientId,read:false,time:new Date().toISOString()};
    updateDbState({...current,notifications:[item,...(current.notifications||[])].slice(0,100)},current);
  };

  const userCanViewFinancials = (user = currentUser) => {
    if (!user) return false;
    if (user.id === 'emp-master' || user.role === 'Administrador' || user.role === 'Gerente') return true;
    if (user.canViewFinancials === true) return true;
    if (user.allowedSections && Array.isArray(user.allowedSections) && user.allowedSections.includes('financials')) return true;
    return false;
  };

  const clearNotifications = () => {
    const current=dbRef.current;if(!current || !currentUser)return;
    updateDbState({...current,notifications:current.notifications.map(n=>!n.recipientId || n.recipientId===currentUser.id?{...n,read:true}:n)},current);
  };
  const refreshDatabase = async () => {
    try {const response=await fetch('/api/db');if(!response.ok)return false;const data=sanitizeDb(await response.json());lastLoadedModifiedRef.current=Number(response.headers.get('X-Last-Modified'));dbRef.current=data;setDb(data);return true;}catch{return false;}
  };

  // --- CRUD WRAPPERS ---

  // 0. User / Employee Manager (Admin only)
  const addEmployee = (employee) => {
    const newEmployee = {
      id: `emp-${Date.now()}`,
      status: 'Activo',
      productivity: { completed: 0, active: 0, performance: 100 },
      ...employee
    };
    const updatedEmployees = [...db.employees, newEmployee];
    let nextDb = { ...db, employees: updatedEmployees };
    nextDb = logActivity('Creación de Usuario', `Usuario "${newEmployee.name}" (${newEmployee.role}) creado por el administrador.`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Nuevo usuario creado: ${newEmployee.name}`);
    return newEmployee;
  };

  const updateEmployee = (employeeId, updates) => {
    const updatedEmployees = db.employees.map(emp => {
      if (emp.id === employeeId) {
        return { ...emp, ...updates };
      }
      return emp;
    });
    let nextDb = { ...db, employees: updatedEmployees };
    nextDb = logActivity('Modificación de Usuario', `Datos del usuario ID ${employeeId} actualizados.`, currentUser, nextDb);
    updateDbState(nextDb);
    // If the updated user is the current user, update currentUser too
    if (currentUser && currentUser.id === employeeId) {
      setCurrentUser(prev => ({ ...prev, ...updates }));
    }
  };

  const deleteEmployee = (employeeId) => {
    if (currentUser && currentUser.id === employeeId) return;
    const updatedEmployees = db.employees.filter(emp => emp.id !== employeeId);
    let nextDb = { ...db, employees: updatedEmployees };
    nextDb = logActivity('Eliminación de Usuario', `Usuario ID ${employeeId} eliminado del sistema.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 1. Clients Manager
  const addClient = (client) => {
    const newClient = {
      id: `cli-${Date.now()}`,
      clientType: client.clientType || 'Normal',
      followUps: client.followUps || [],
      ...client,
      status: 'Activo',
      infrastructure: client.infrastructure || { servers: [], vpn: { ip: '', type: '', user: '' } },
      credentials: client.credentials || []
    };
    const updatedClients = [...db.clients, newClient];
    let nextDb = { ...db, clients: updatedClients };
    nextDb = logActivity('Registro de Cliente', `Cliente "${newClient.commercialName}" creado exitosamente.`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Nuevo cliente registrado: ${newClient.commercialName}`);
  };

  const updateClient = (clientId, updates) => {
    const updatedClients = db.clients.map(client => {
      if (client.id === clientId) {
        return { ...client, ...updates };
      }
      return client;
    });
    let nextDb = { ...db, clients: updatedClients };
    nextDb = logActivity('Actualización de Cliente', `Cliente ID ${clientId} actualizado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const updateClientTechnical = (clientId, infrastructure, credentials, files, layout, logAction = null, logDetails = null) => {
    const updatedClients = db.clients.map(client => {
      if (client.id === clientId) {
        return { 
          ...client, 
          infrastructure: infrastructure !== undefined ? infrastructure : (client.infrastructure || { servers: [], workstations: [], vpn: { ip: '', type: '', user: '' } }), 
          credentials: credentials !== undefined ? credentials : (client.credentials || []),
          files: files !== undefined ? files : (client.files || []),
          layout: layout !== undefined ? layout : (client.layout || [])
        };
      }
      return client;
    });
    let nextDb = { ...db, clients: updatedClients };
    const action = logAction || 'Actualización Técnica';
    const details = logDetails || `Configuración técnica actualizada (infra, creds, archivos o planos) para cliente ID: ${clientId}`;
    nextDb = logActivity(action, details, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const addClientFollowUp = (clientId, comment) => {
    const today = new Date();
    const dateStr = today.getFullYear() + '-' + 
      String(today.getMonth() + 1).padStart(2, '0') + '-' + 
      String(today.getDate()).padStart(2, '0') + ' ' + 
      String(today.getHours()).padStart(2, '0') + ':' + 
      String(today.getMinutes()).padStart(2, '0');

    const newFollowUp = {
      id: Date.now(),
      date: dateStr,
      user: currentUser ? currentUser.name : 'Sistema',
      comment
    };

    const updatedClients = db.clients.map(client => {
      if (client.id === clientId) {
        return {
          ...client,
          followUps: [...(client.followUps || []), newFollowUp]
        };
      }
      return client;
    });

    let nextDb = { ...db, clients: updatedClients };
    nextDb = logActivity('Seguimiento Cliente', `Agregó comentario de seguimiento al cliente ID: ${clientId}`, currentUser, nextDb);
    updateDbState(nextDb);

    const client = db.clients.find(c => c.id === clientId);
    if (client && currentUser) {
      addNotification(`${currentUser.name} agregó nota de seguimiento a ${client.commercialName}: "${comment}"`);
    }
  };

  // 2. Project & Task Manager
  const addProject = (project) => {
    const newProject = {
      id: `proj-${Date.now()}`,
      ...project,
      progress: 0,
      tasks: [],
      annotations: []
    };
    const updatedProjects = [...db.projects, newProject];
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Creación de Proyecto', `Proyecto "${newProject.name}" creado.`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Nuevo proyecto creado: ${newProject.name}`);
  };

  const deleteProject = (projectId) => {
    if (currentUser && currentUser.role !== 'Administrador' && currentUser.id !== 'emp-master') {
      console.error('Permiso denegado: solo el Master o Administrador puede eliminar proyectos.');
      return;
    }
    const updatedProjects = (db.projects || []).filter(p => p.id !== projectId);
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Eliminación de Proyecto', `Proyecto ID ${projectId} eliminado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const addProjectAnnotation = (projectId, content) => {
    const now = new Date();
    const timestamp = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + ' ' + 
      String(now.getHours()).padStart(2, '0') + ':' + 
      String(now.getMinutes()).padStart(2, '0');

    const newAnnotation = {
      id: `ann-${Date.now()}`,
      timestamp,
      user: currentUser ? currentUser.name : 'Sistema',
      content
    };

    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        return {
          ...p,
          annotations: [newAnnotation, ...(p.annotations || [])]
        };
      }
      return p;
    });

    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Anotación de Proyecto', `Añadió anotación al proyecto ID ${projectId}`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const updateProjectStatus = (projectId, status) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        return { ...p, status };
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Cambio Estado Proyecto', `Proyecto ID ${projectId} cambiado a "${status}".`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const updateProjectPriority = (projectId, priority) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        return { ...p, priority };
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Cambio Prioridad Proyecto', `Proyecto ID ${projectId} prioridad cambiada a "${priority}".`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const recalculateProjectProgress = (project) => {
    if (!project.tasks || project.tasks.length === 0) return 0;
    const completed = project.tasks.filter(t => t.status === 'Completada').length;
    return Math.round((completed / project.tasks.length) * 100);
  };

  const addTaskToProject = (projectId, task) => {
    const newTask = {
      id: `t-${Date.now()}`,
      timeSpent: 0,
      comments: [],
      subtasks: task.subtasks || [],
      ...task
    };
    
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = [...p.tasks, newTask];
        const updatedProject = { ...p, tasks: updatedTasks };
        updatedProject.progress = recalculateProjectProgress(updatedProject);
        return updatedProject;
      }
      return p;
    });

    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Asignación de Tarea', `Tarea "${newTask.title}" agregada al proyecto ID ${projectId}`, currentUser, nextDb);
    updateDbState(nextDb);
    
    const project = db.projects.find(p => p.id === projectId);
    if (newTask.assigneeId && currentUser && currentUser.id !== newTask.assigneeId) {
      addNotification(`${currentUser.name} te asignó la tarea: "${newTask.title}" en el proyecto "${project ? project.name : ''}"`, newTask.assigneeId);
    }
  };

  const updateTaskStatus = (projectId, taskId, status) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = p.tasks.map(t => {
          if (t.id === taskId) {
            const updatedTask = { ...t, status };
            if (status !== 'Completada') {
              updatedTask.completedByName = '';
            } else if (!updatedTask.completedByName) {
              updatedTask.completedByName = currentUser ? currentUser.name : 'Master JC';
            }
            return updatedTask;
          }
          return t;
        });
        const updatedProject = { ...p, tasks: updatedTasks };
        updatedProject.progress = recalculateProjectProgress(updatedProject);
        return updatedProject;
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Cambio Estado Tarea', `Tarea ID ${taskId} cambiada a "${status}".`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteTaskFromProject = (projectId, taskId) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = p.tasks.filter(t => t.id !== taskId);
        const updatedProject = { ...p, tasks: updatedTasks };
        updatedProject.progress = recalculateProjectProgress(updatedProject);
        return updatedProject;
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Eliminación de Tarea', `Tarea ID ${taskId} eliminada del proyecto ID ${projectId}.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const updateTaskFields = (projectId, taskId, updates) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = p.tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, ...updates };
          }
          return t;
        });
        const updatedProject = { ...p, tasks: updatedTasks };
        updatedProject.progress = recalculateProjectProgress(updatedProject);
        return updatedProject;
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Actualización de Tarea', `Campos de tarea ID ${taskId} actualizados.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const addCommentToTask = (projectId, taskId, commentText) => {
    const now = new Date();
    const timeStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0') + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    
    const newComment = {
      id: `cm-${Date.now()}`,
      user: currentUser ? currentUser.name : 'Usuario',
      content: commentText,
      time: timeStr
    };

    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = p.tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, comments: [...t.comments, newComment] };
          }
          return t;
        });
        return { ...p, tasks: updatedTasks };
      }
      return p;
    });

    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Comentario en Tarea', `Comentario agregado a la tarea ID ${taskId}`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 3. Agenda Manager
  const updateAgendaStatus = (agendaId, status) => {
    const agendaItem = db.agenda.find(a => a.id === agendaId);
    if (!agendaItem) return;
    
    const isAdminOrGerente = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Gerente');
    const isAssignee = currentUser && currentUser.id === agendaItem.employeeId;

    if (!isAdminOrGerente && !isAssignee) {
      console.error('Permiso denegado: no autorizado para actualizar esta actividad.');
      return;
    }

    const updatedAgenda = db.agenda.map(a => {
      if (a.id === agendaId) {
        return { ...a, status };
      }
      return a;
    });
    let nextDb = { ...db, agenda: updatedAgenda };
    nextDb = logActivity('Actualización de Agenda', `Actividad de agenda ID ${agendaId} marcada como ${status}.`, currentUser, nextDb);
    updateDbState(nextDb);

    if (agendaItem.employeeId && currentUser && currentUser.id !== agendaItem.employeeId) {
      addNotification(`Actividad "${agendaItem.title}" marcada como ${status} por ${currentUser.name}`, agendaItem.employeeId);
    }
  };

  const addAgendaItem = (item) => {
    const isAdminOrGerente = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Gerente');
    const isSelfAssignment = currentUser && item.employeeId === currentUser.id;
    if (!isAdminOrGerente && !isSelfAssignment) {
      console.error('Permiso denegado: no autorizado para programar actividades para otros empleados.');
      return;
    }
    const newItem = {
      id: `ag-${Date.now()}`,
      status: 'Pendiente',
      ...item
    };
    const updatedAgenda = [...db.agenda, newItem];
    let nextDb = { ...db, agenda: updatedAgenda };
    nextDb = logActivity('Registro de Agenda', `Actividad "${newItem.title}" programada.`, currentUser, nextDb);
    updateDbState(nextDb);

    if (newItem.employeeId && currentUser && currentUser.id !== newItem.employeeId) {
      addNotification(`${currentUser.name} te agendó una actividad: "${newItem.title}" para el ${newItem.date}`, newItem.employeeId);
    }
  };

  const updateAgendaItem = (agendaId, updatedFields) => {
    const agendaItem = db.agenda.find(a => a.id === agendaId);
    if (!agendaItem) return;

    const isAdminOrGerente = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Gerente');
    const isAssignee = currentUser && currentUser.id === agendaItem.employeeId;

    if (!isAdminOrGerente && !isAssignee) {
      console.error('Permiso denegado: no autorizado para editar esta actividad.');
      return;
    }

    const updatedAgenda = db.agenda.map(a => {
      if (a.id === agendaId) {
        return { ...a, ...updatedFields };
      }
      return a;
    });
    let nextDb = { ...db, agenda: updatedAgenda };
    nextDb = logActivity('Edición de Agenda', `Actividad de agenda ID ${agendaId} editada.`, currentUser, nextDb);
    updateDbState(nextDb);

    if (agendaItem.employeeId && currentUser && currentUser.id !== agendaItem.employeeId) {
      addNotification(`Actividad "${agendaItem.title}" fue modificada por ${currentUser.name}`, agendaItem.employeeId);
    }
  };

  const deleteAgendaItem = (agendaId) => {
    const agendaItem = db.agenda.find(a => a.id === agendaId);
    if (!agendaItem) return;

    const isAdminOrGerente = currentUser && (currentUser.role === 'Administrador' || currentUser.role === 'Gerente');
    const isAssignee = currentUser && currentUser.id === agendaItem.employeeId;

    if (!isAdminOrGerente && !isAssignee) {
      console.error('Permiso denegado: no autorizado para eliminar esta actividad.');
      return;
    }

    const updatedAgenda = db.agenda.filter(a => a.id !== agendaId);
    let nextDb = { ...db, agenda: updatedAgenda };
    nextDb = logActivity('Eliminación de Agenda', `Actividad ID ${agendaId} eliminada.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 4. Tickets Manager
  const addTicket = (ticket) => {
    let nextNum = 1001;
    if (db.tickets && db.tickets.length > 0) {
      const numbers = db.tickets.map(t => {
        const match = t.id.match(/\d+/);
        return match ? parseInt(match[0], 10) : 1000;
      });
      nextNum = Math.max(...numbers) + 1;
    }
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newTicket = {
      id: `tck-${nextNum}`,
      createdAt: nowIso,
      assignedAt: ticket.assigneeId ? nowIso : null,
      firstResponseAt: null,
      closedAt: null,
      resolvedAt: null,
      reopenCount: 0,
      slaPausedMs: 0,
      slaPauseStartedAt: null,
      csatRating: null,
      status: 'Abierto',
      history: [
        { action: 'Ticket creado', user: currentUser ? currentUser.name : 'Cliente', date: nowIso }
      ],
      ...ticket
    };
    const updatedTickets = [...db.tickets, newTicket];
    let nextDb = { ...db, tickets: updatedTickets };
    nextDb = logActivity('Creación de Ticket', `Ticket de soporte "${newTicket.title}" generado.`, currentUser, nextDb);
    updateDbState(nextDb);
    
    if (newTicket.assigneeId && currentUser && currentUser.id !== newTicket.assigneeId) {
      addNotification(`${currentUser.name} te asignó el ticket: "${newTicket.title}"`, newTicket.assigneeId);
    } else {
      addNotification(`Nuevo ticket de soporte: "${newTicket.title}" (${newTicket.clientName})`);
    }
    playBellSound();
    return newTicket.id;
  };

  const reassignTicket = (ticketId, assigneeId) => {
    if (!db) return;
    const assigneeObj = db.employees.find(emp => emp.id === assigneeId);
    const assigneeName = assigneeObj ? assigneeObj.name : 'Sin asignar';
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const updatedTickets = db.tickets.map(t => {
      if (t.id === ticketId) {
        const newHistory = {
          action: `Ticket reasignado a ${assigneeName}`,
          user: currentUser ? currentUser.name : 'Sistema',
          date: nowIso
        };
        return {
          ...t,
          assigneeId,
          assigneeName,
          assignedAt: t.assignedAt || nowIso,
          history: [...t.history, newHistory],
          status: t.status === 'Abierto' ? 'Asignado' : t.status
        };
      }
      return t;
    });

    let nextDb = { ...db, tickets: updatedTickets };
    nextDb = logActivity('Reasignación de Ticket', `Ticket ID ${ticketId} reasignado a ${assigneeName}.`, currentUser, nextDb);
    updateDbState(nextDb);

    if (assigneeId && currentUser && currentUser.id !== assigneeId) {
      addNotification(`${currentUser.name} te asignó el ticket: "${db.tickets.find(t => t.id === ticketId)?.title}"`, assigneeId);
    }
    playBellSound();
  };

  const updateTicketStatus = (ticketId, status, comment) => {
    let closedBy = undefined;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 16);
    if (status === 'Cerrado') {
      closedBy = currentUser ? currentUser.name : 'Sistema';
    }

    const updatedTickets = db.tickets.map(t => {
      if (t.id === ticketId) {
        const newHistory = {
          action: `Estado cambiado a ${status}${comment ? ' - ' + comment : ''}`,
          user: currentUser ? currentUser.name : 'Sistema',
          date: nowIso
        };

        let newFirstResponseAt = t.firstResponseAt;
        if (!newFirstResponseAt && currentUser && currentUser.role !== 'Cliente') {
          newFirstResponseAt = nowIso;
        }

        // SLA Auto-Pause logic:
        let newSlaPausedMs = t.slaPausedMs || 0;
        let newSlaPauseStartedAt = t.slaPauseStartedAt || null;

        const isPausingStatus = (status === 'Espera cliente' || status === 'Esperando respuesta del usuario' || status === 'Esperando repuesto');
        const wasPausingStatus = (t.status === 'Espera cliente' || t.status === 'Esperando respuesta del usuario' || t.status === 'Esperando repuesto');

        if (isPausingStatus && !wasPausingStatus) {
          newSlaPauseStartedAt = new Date().toISOString();
        } else if (!isPausingStatus && wasPausingStatus && newSlaPauseStartedAt) {
          const pauseDiff = new Date() - new Date(newSlaPauseStartedAt);
          if (pauseDiff > 0) {
            newSlaPausedMs += pauseDiff;
          }
          newSlaPauseStartedAt = null;
        }

        // Re-open Auto-reassignment & Re-open Count logic:
        let newReopenCount = t.reopenCount || 0;
        let newAssigneeId = t.assigneeId;
        let newAssigneeName = t.assigneeName;

        if (status === 'Reabierto' && t.status !== 'Reabierto') {
          newReopenCount += 1;
          // Re-assign to original technician who resolved it
          if (t.previousAssigneeId) {
            newAssigneeId = t.previousAssigneeId;
            const originalEmp = db.employees.find(e => e.id === t.previousAssigneeId);
            newAssigneeName = originalEmp ? originalEmp.name : t.assigneeName;
          }
        }

        const updatedT = {
          ...t,
          status,
          solution: (status === 'Cerrado' || status === 'Resuelto') ? (comment || t.solution || '') : (t.solution || ''),
          firstResponseAt: newFirstResponseAt,
          slaPausedMs: newSlaPausedMs,
          slaPauseStartedAt: newSlaPauseStartedAt,
          reopenCount: newReopenCount,
          assigneeId: newAssigneeId,
          assigneeName: newAssigneeName,
          previousAssigneeId: (status === 'Resuelto' || status === 'Cerrado') ? (t.assigneeId || t.previousAssigneeId) : t.previousAssigneeId,
          resolvedAt: status === 'Resuelto' ? (t.resolvedAt || nowIso) : t.resolvedAt,
          closedAt: status === 'Cerrado' ? (t.closedAt || nowIso) : t.closedAt,
          history: [...t.history, newHistory]
        };
        if (closedBy) {
          updatedT.closedBy = closedBy;
        }
        return updatedT;
      }
      return t;
    });

    let updatedEmployees = db.employees;
    if (status === 'Cerrado' || status === 'Resuelto') {
      const targetTicket = db.tickets.find(t => t.id === ticketId);
      const targetEmpId = targetTicket?.assigneeId || (currentUser ? currentUser.id : null);
      
      if (targetEmpId) {
        updatedEmployees = db.employees.map(emp => {
          if (emp.id === targetEmpId) {
            return {
              ...emp,
              productivity: {
                ...emp.productivity,
                completed: (emp.productivity?.completed || 0) + 1
              }
            };
          }
          return emp;
        });
      }
    }

    let nextDb = { ...db, tickets: updatedTickets, employees: updatedEmployees };
    nextDb = logActivity('Actualización de Ticket', `Ticket ID ${ticketId} cambiado a "${status}".`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const rateTicketCsat = (ticketId, rating, feedback = null) => {
    if (!db) return;
    const updatedTickets = (db.tickets || []).map(t => {
      if (t.id === ticketId) {
        return {
          ...t,
          csatRating: rating !== null ? Math.min(5, Math.max(1, rating)) : t.csatRating,
          csatFeedback: feedback !== null ? feedback : (t.csatFeedback || '')
        };
      }
      return t;
    });
    const nextDb = { ...db, tickets: updatedTickets };
    updateDbState(nextDb);
  };

  const updateTicketDetails = (ticketId, updates) => {
    const updatedTickets = db.tickets.map(t => {
      if (t.id === ticketId) {
        const newHistory = {
          action: `Información del ticket editada`,
          user: currentUser ? currentUser.name : 'Sistema',
          date: new Date().toISOString().replace('T', ' ').substring(0, 16)
        };
        let newClientName = t.clientName;
        if (updates.clientId) {
          const clientObj = (db.clients || []).find(c => c.id === updates.clientId);
          if (clientObj) {
            newClientName = clientObj.commercialName;
          }
        }
        return {
          ...t,
          ...updates,
          clientName: newClientName,
          history: [...(t.history || []), newHistory]
        };
      }
      return t;
    });

    let nextDb = { ...db, tickets: updatedTickets };
    nextDb = logActivity('Edición de Ticket', `Ticket ID ${ticketId} editado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 5. Weekly Goals
  const updateGoalProgress = (goalId, progress) => {
    const updatedGoals = db.weeklyGoals.map(g => {
      if (g.id === goalId) {
        return { ...g, progress, completed: progress === 100 };
      }
      return g;
    });
    updateDbState({ ...db, weeklyGoals: updatedGoals });
  };

  const addWeeklyGoal = (title) => {
    const newGoal = {
      id: `wg-${Date.now()}`,
      title,
      completed: false,
      progress: 0
    };
    const updatedGoals = [...db.weeklyGoals, newGoal];
    let nextDb = { ...db, weeklyGoals: updatedGoals };
    nextDb = logActivity('Meta Semanal Creada', `Nueva meta semanal agregada: "${title}"`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const logTaskHours = (projectId, taskId, hours) => {
    const updatedProjects = db.projects.map(p => {
      if (p.id === projectId) {
        const updatedTasks = p.tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, timeSpent: t.timeSpent + hours };
          }
          return t;
        });
        return { ...p, tasks: updatedTasks };
      }
      return p;
    });
    let nextDb = { ...db, projects: updatedProjects };
    nextDb = logActivity('Registro de Horas', `Registró ${hours} horas en la tarea ID ${taskId}`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const toggleWeeklyGoal = (goalId) => {
    const updatedGoals = db.weeklyGoals.map(g => {
      if (g.id === goalId) {
        const completed = !g.completed;
        return { ...g, completed, progress: completed ? 100 : 0 };
      }
      return g;
    });
    let nextDb = { ...db, weeklyGoals: updatedGoals };
    nextDb = logActivity('Meta Semanal Actualizada', `Actualizó estado de meta ID ${goalId}`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const rescheduleAgendaItem = (agendaId, newDate) => {
    const isMaster = currentUser && currentUser.role === 'Administrador';
    if (!isMaster) {
      console.error('Permiso denegado: solo master puede reprogramar actividades.');
      return;
    }
    const updatedAgenda = db.agenda.map(a => {
      if (a.id === agendaId) {
        return { ...a, date: newDate, status: 'Reprogramado' };
      }
      return a;
    });
    let nextDb = { ...db, agenda: updatedAgenda };
    nextDb = logActivity('Reprogramación Agenda', `Actividad de agenda ID ${agendaId} reprogramada para el ${newDate}.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 6. Referrals & Bonuses Manager
  const addReferral = (referral) => {
    const newReferral = {
      id: `ref-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      status: 'Pendiente',
      employeeId: currentUser ? currentUser.id : 'master',
      employeeName: currentUser ? currentUser.name : 'Master JC',
      bonusAmount: parseFloat(referral.bonusAmount) || 0,
      clientName: referral.clientName,
      details: referral.details || '',
      approvedDate: null
    };
    const updatedReferrals = [...(db.referrals || []), newReferral];
    let nextDb = { ...db, referrals: updatedReferrals };
    nextDb = logActivity('Registro de Referido', `Empleado registró cliente referido: "${newReferral.clientName}" para bonificación de $${newReferral.bonusAmount}`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Nuevo referido registrado por ${newReferral.employeeName}`);
  };

  const approveReferralBonus = (referralId, status) => {
    const isMaster = currentUser && currentUser.role === 'Administrador';
    if (!isMaster) {
      console.error('Permiso denegado: solo master puede aprobar o rechazar bonos.');
      return;
    }
    const updatedReferrals = (db.referrals || []).map(ref => {
      if (ref.id === referralId) {
        return { 
          ...ref, 
          status, 
          approvedDate: status === 'Aprobado' ? new Date().toISOString().split('T')[0] : null 
        };
      }
      return ref;
    });
    
    const targetRef = (db.referrals || []).find(r => r.id === referralId);
    if (!targetRef) return;

    let nextDb = { ...db, referrals: updatedReferrals };
    nextDb = logActivity('Aprobación de Bono', `Bono del referido ID ${referralId} cambiado a "${status}".`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`El bono para ${targetRef.clientName} ha sido ${status.toLowerCase()}`);
  };

  const updateReferralBonus = (referralId, amount) => {
    const isMaster = currentUser && currentUser.role === 'Administrador';
    if (!isMaster) {
      console.error('Permiso denegado: solo master puede editar bonos.');
      return;
    }
    const updatedReferrals = (db.referrals || []).map(ref => {
      if (ref.id === referralId) {
        return { 
          ...ref, 
          bonusAmount: parseFloat(amount) || 0
        };
      }
      return ref;
    });
    let nextDb = { ...db, referrals: updatedReferrals };
    nextDb = logActivity('Edición de Bono', `Monto del bono del referido ID ${referralId} modificado a $${amount}.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const checkRecurringIssues = (clientId, station, description) => {
    if (!db || !db.tickets || !description) return [];
    
    const stopwords = new Set([
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'y', 'o', 'en', 'para', 'con', 'no', 'si', 'su', 'sus', 'por', 'es', 'se', 'lo', 'que', 'a', 'como', 'con', 'del', 'las', 'los', 'por', 'con', 'fallo', 'error', 'falla', 'problema', 'jc', 'softway', 'soft'
    ]);

    const words = description
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));

    if (words.length === 0) return [];

    const sameClientTickets = db.tickets.filter(t => 
      t.clientId === clientId && 
      (t.status === 'Cerrado' || t.solution)
    );

    const matches = [];

    sameClientTickets.forEach(t => {
      let score = 0;
      const tDesc = (t.description || "").toLowerCase();
      const tTitle = (t.title || "").toLowerCase();
      
      words.forEach(word => {
        if (tDesc.includes(word) || tTitle.includes(word)) {
          score += 1;
        }
      });

      const sameStation = station && t.station && t.station.toLowerCase() === station.toLowerCase();
      if (sameStation) {
        score += 2;
      }

      if (score > 0) {
        matches.push({
          ticket: t,
          score,
          sameStation
        });
      }
    });

    matches.sort((a, b) => b.score - a.score);

    return matches.map(m => ({
      id: m.ticket.id,
      title: m.ticket.title,
      description: m.ticket.description,
      solution: m.ticket.solution || "No documentada",
      date: m.ticket.createdAt,
      station: m.ticket.station,
      score: m.score,
      sameStation: m.sameStation
    })).slice(0, 3);
  };

  const updateClientLayout = (clientId, layoutArray, logDetails = null) => {
    const updatedClients = db.clients.map(client => {
      if (client.id === clientId) {
        return { 
          ...client, 
          layout: layoutArray
        };
      }
      return client;
    });
    let nextDb = { ...db, clients: updatedClients };
    const details = logDetails || `Plano actualizado para el cliente ID: ${clientId}`;
    nextDb = logActivity('Plano de Instalación', details, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // 7. Knowledge Base Wiki
  const addWikiArticle = (article) => {
    const newArticle = {
      id: `kb-${Date.now()}`,
      lastUpdated: new Date().toISOString().split('T')[0],
      author: currentUser ? currentUser.name : 'Sistema',
      ...article,
      tags: typeof article.tags === 'string'
        ? article.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
        : (Array.isArray(article.tags) ? article.tags : []),
      errorCode: article.errorCode ? article.errorCode.trim() : ''
    };
    const updatedWiki = [...db.knowledgeBase, newArticle];
    let nextDb = { ...db, knowledgeBase: updatedWiki };
    nextDb = logActivity('Wiki Artículo Creado', `Nuevo artículo de soporte creado: "${newArticle.title}"`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Wiki actualizada: ${newArticle.title}`);
  };

  const updateWikiArticle = (articleId, updates) => {
    const isMaster = currentUser && (currentUser.role === 'Administrador' || currentUser.id === 'emp-master');
    if (!isMaster) {
      console.error('Permiso denegado: solo master puede editar artículos.');
      return;
    }
    const updatedWiki = db.knowledgeBase.map(art => {
      if (art.id === articleId) {
        return {
          ...art,
          ...updates,
          lastUpdated: new Date().toISOString().split('T')[0],
          tags: typeof updates.tags === 'string'
            ? updates.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
            : (Array.isArray(updates.tags) ? updates.tags : (art.tags || []))
        };
      }
      return art;
    });
    let nextDb = { ...db, knowledgeBase: updatedWiki };
    nextDb = logActivity('Wiki Artículo Modificado', `Artículo de soporte ID "${articleId}" modificado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteWikiArticle = (articleId) => {
    const isMaster = currentUser && (currentUser.role === 'Administrador' || currentUser.id === 'emp-master');
    if (!isMaster) {
      console.error('Permiso denegado: solo master puede eliminar artículos.');
      return;
    }
    const updatedWiki = db.knowledgeBase.filter(art => art.id !== articleId);
    let nextDb = { ...db, knowledgeBase: updatedWiki };
    nextDb = logActivity('Wiki Artículo Eliminado', `Artículo de soporte ID "${articleId}" eliminado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };
  // 8. Utilitarios
  const addUtilityFile = (file) => {
    const newFile = {
      id: `ut-${Date.now()}`,
      uploadDate: new Date().toISOString().split('T')[0],
      author: currentUser ? currentUser.name : 'Sistema',
      authorId: currentUser ? currentUser.id : 'sistema',
      ...file
    };
    const updatedUtilitarios = [...(db.utilitarios || []), newFile];
    let nextDb = { ...db, utilitarios: updatedUtilitarios };
    
    // Log activity directly on nextDb
    nextDb = logActivity('Archivo Utilitario Subido', `Se subió el archivo utilitario "${newFile.name}"`, currentUser, nextDb);
    
    // Create new notification object
    const newNotif = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      text: `Nuevo utilitario subido: ${newFile.name}`,
      read: false,
      time: new Date().toISOString().replace('T', ' ').substring(0, 16),
      recipientId: null
    };
    nextDb.notifications = [newNotif, ...(nextDb.notifications || [])].slice(0, 100);
    
    // Play sound locally
    playBellSound();
    
    // Update local state and save to DB in one atomic step
    updateDbState(nextDb);
  };
  const deleteUtilityFile = (fileId) => {
    const file = (db.utilitarios || []).find(f => f.id === fileId);
    if (!file) return;

    const isMaster = currentUser && (currentUser.role === 'Administrador' || currentUser.id === 'emp-master');
    const isAuthor = currentUser && currentUser.id === file.authorId;
    if (!isMaster && !isAuthor) {
      console.error('Permiso denegado: no autorizado para eliminar este archivo.');
      return;
    }

    const updatedUtilitarios = (db.utilitarios || []).filter(f => f.id !== fileId);
    let nextDb = { ...db, utilitarios: updatedUtilitarios };
    nextDb = logActivity('Archivo Utilitario Eliminado', `Se eliminó el archivo utilitario "${file.name}"`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // --- SERVICE REPORTS CRUD ---
  const addServiceReport = (report) => {
    const now = new Date();
    const localDateStr = now.getFullYear() + '-' + 
      String(now.getMonth() + 1).padStart(2, '0') + '-' + 
      String(now.getDate()).padStart(2, '0') + ' ' + 
      String(now.getHours()).padStart(2, '0') + ':' + 
      String(now.getMinutes()).padStart(2, '0');

    const newReport = {
      id: `sr-${Date.now()}`,
      createdAt: localDateStr,
      createdBy: currentUser ? currentUser.name : 'Sistema',
      createdById: currentUser ? currentUser.id : 'sistema',
      images: [],
      ...report
    };
    const updatedReports = [...(db.serviceReports || []), newReport];
    let nextDb = { ...db, serviceReports: updatedReports };
    nextDb = logActivity('Reporte de Servicio Creado', `Se creó el reporte de servicio ID ${newReport.id} para el cliente "${newReport.clientName}"`, currentUser, nextDb);
    updateDbState(nextDb);
    addNotification(`Nuevo reporte de servicio creado para ${newReport.clientName}`);
    return newReport.id;
  };

  const updateServiceReport = (reportId, updates) => {
    const updatedReports = (db.serviceReports || []).map(r => {
      if (r.id === reportId) {
        return { ...r, ...updates };
      }
      return r;
    });
    let nextDb = { ...db, serviceReports: updatedReports };
    nextDb = logActivity('Reporte de Servicio Modificado', `Reporte de servicio ID ${reportId} modificado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteServiceReport = (reportId) => {
    const report = (db.serviceReports || []).find(r => r.id === reportId);
    if (!report) return;
    const updatedReports = (db.serviceReports || []).filter(r => r.id !== reportId);
    let nextDb = { ...db, serviceReports: updatedReports };
    nextDb = logActivity('Reporte de Servicio Eliminado', `Se eliminó el reporte de servicio ID ${reportId}`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // --- TICKET CATEGORIES CRUD ---
  const addTicketCategory = (name) => {
    if (!name || (db.ticketCategories || []).includes(name)) return;
    const updatedCategories = [...(db.ticketCategories || []), name];
    let nextDb = { ...db, ticketCategories: updatedCategories };
    nextDb = logActivity('Categoría Ticket Creada', `Categoría de ticket "${name}" creada.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteTicketCategory = (name) => {
    const updatedCategories = (db.ticketCategories || []).filter(c => c !== name);
    let nextDb = { ...db, ticketCategories: updatedCategories };
    nextDb = logActivity('Categoría Ticket Eliminada', `Categoría de ticket "${name}" eliminada.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  // --- A2 CATEGORIES & REPORTS CRUD ---
  const addA2Category = (name) => {
    const newCategory = {
      id: `cat-${Date.now()}`,
      name
    };
    const updatedCategories = [...(db.a2Categories || []), newCategory];
    let nextDb = { ...db, a2Categories: updatedCategories };
    nextDb = logActivity('Categoría A2 Creada', `Categoría de reportes "${name}" creada.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteA2Category = (id) => {
    const category = (db.a2Categories || []).find(c => c.id === id);
    const updatedCategories = (db.a2Categories || []).filter(c => c.id !== id);
    const updatedReports = (db.a2Reports || []).map(r => r.categoryId === id ? { ...r, categoryId: '' } : r);
    let nextDb = { ...db, a2Categories: updatedCategories, a2Reports: updatedReports };
    nextDb = logActivity('Categoría A2 Eliminada', `Categoría de reportes "${category ? category.name : id}" eliminada.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const addA2Report = (report) => {
    const newReport = {
      id: `rep-${Date.now()}`,
      files: [],
      ...report
    };
    const updatedReports = [...(db.a2Reports || []), newReport];
    let nextDb = { ...db, a2Reports: updatedReports };
    nextDb = logActivity('Reporte A2 Creado', `Reporte a2 "${newReport.title}" creado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const updateA2Report = (reportId, updates) => {
    const updatedReports = (db.a2Reports || []).map(r => r.id === reportId ? { ...r, ...updates } : r);
    let nextDb = { ...db, a2Reports: updatedReports };
    nextDb = logActivity('Reporte A2 Modificado', `Reporte a2 ID "${reportId}" modificado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  const deleteA2Report = (reportId) => {
    const report = (db.a2Reports || []).find(r => r.id === reportId);
    const updatedReports = (db.a2Reports || []).filter(r => r.id !== reportId);
    let nextDb = { ...db, a2Reports: updatedReports };
    nextDb = logActivity('Reporte A2 Eliminado', `Reporte a2 "${report ? report.title : reportId}" eliminado.`, currentUser, nextDb);
    updateDbState(nextDb);
  };

  return (
    <AppContext.Provider
      value={{
        db,
        saveError,
        loading,
        splashDone,
        isAuthenticated,
        currentUser,
        activeTab,
        theme,
        notifications,
        pendingTicket,
        setPendingTicket,
        setIsAuthenticated,
        setCurrentUser,
        setActiveTab,
        setTheme,
        logActivity,
        login,
        logout,
        changeUserRole,
        clearNotifications,
        userCanViewFinancials,
        // Employees / Users
        addEmployee,
        updateEmployee,
        deleteEmployee,
        // Utilities & Sync
        refreshDatabase,
        // Clients
        addClient,
        updateClient,
        updateClientTechnical,
        addClientFollowUp,
        // Projects & Tasks
        addProject,
        deleteProject,
        addProjectAnnotation,
        updateProjectStatus,
        updateProjectPriority,
        addTaskToProject,
        updateTaskStatus,
        deleteTaskFromProject,
        updateTaskFields,
        addCommentToTask,
        logTaskHours,
        // Agenda
        updateAgendaStatus,
        addAgendaItem,
        updateAgendaItem,
        deleteAgendaItem,
        rescheduleAgendaItem,
        // Tickets
        addTicket,
        updateTicketStatus,
        updateTicketDetails,
        reassignTicket,
        rateTicketCsat,
        addTicketCategory,
        deleteTicketCategory,
        // Goals
        updateGoalProgress,
        addWeeklyGoal,
        toggleWeeklyGoal,
        // Referrals & Bonificaciones
        addReferral,
        approveReferralBonus,
        updateReferralBonus,
        checkRecurringIssues,
        // Layouts
        updateClientLayout,
        // Wiki
        addWikiArticle,
        updateWikiArticle,
        deleteWikiArticle,
        // Utilitarios
        addUtilityFile,
        deleteUtilityFile,
        // Service Reports
        addServiceReport,
        updateServiceReport,
        deleteServiceReport,
        // A2 Reports & Categories
        addA2Category,
        deleteA2Category,
        addA2Report,
        updateA2Report,
        deleteA2Report
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
