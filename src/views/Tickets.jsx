import React, { useContext, useState, useEffect } from 'react';
import { AppContext, getApiUrl } from '../context/AppContext';
import Modal from '../components/Modal';
import ImageLightbox from '../components/ImageLightbox';

export default function Tickets() {
  const {
    db,
    currentUser,
    addTicket,
    updateTicketStatus,
    updateTicketDetails,
    reassignTicket,
    rateTicketCsat,
    checkRecurringIssues,
    addTicketCategory,
    pendingTicket,
    setPendingTicket
  } = useContext(AppContext);

  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [showAddTicket, setShowAddTicket] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('Abierto');

  // New ticket state
  const [tckTitle, setTckTitle] = useState('');
  const [tckDesc, setTckDesc] = useState('');
  const [tckClient, setTckClient] = useState('');
  const [tckClientSearch, setTckClientSearch] = useState('');
  const [tckCategory, setTckCategory] = useState(db?.ticketCategories?.[0] || 'Soporte de Software');
  const [tckPriority, setTckPriority] = useState('Media');
  const [tckAssignee, setTckAssignee] = useState('');
  const [tckStation, setTckStation] = useState('');

  // Category addition states
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Update Status comments
  const [tckComment, setTckComment] = useState('');
  const [nextStatus, setNextStatus] = useState('');

  // Edit ticket state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editClient, setEditClient] = useState('');
  const [editStation, setEditStation] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editPriority, setEditPriority] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [tckImage, setTckImage] = useState('');
  const [editImage, setEditImage] = useState('');
  const [lightboxImg, setLightboxImg] = useState(null);

  // Handle pre-filling when creating a ticket from a service report
  useEffect(() => {
    if (pendingTicket) {
      setTckTitle(pendingTicket.title || '');
      setTckDesc(pendingTicket.description || '');
      setTckClient(pendingTicket.clientId || '');
      if (pendingTicket.clientId && db?.clients) {
        const clientObj = db.clients.find(c => c.id === pendingTicket.clientId);
        if (clientObj) {
          setTckClientSearch(clientObj.commercialName);
        }
      }
      setTckImage(pendingTicket.imageUrl || '');
      setShowAddTicket(true);
      
      // Clear it so it doesn't open again next time the tab is visited
      setPendingTicket(null);
    }
  }, [pendingTicket, db, setPendingTicket]);

  const activeTicket = db?.tickets?.find(t => t.id === selectedTicketId) || db?.tickets?.[0];
  const activeTicketImg = activeTicket ? (activeTicket.imageUrl || activeTicket.photoUrl) : '';

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editTitle || !activeTicket) return;

    const assigneeObj = db.employees.find(emp => emp.id === editAssignee);
    const clientObj = db.clients.find(c => c.id === editClient);

    updateTicketDetails(activeTicket.id, {
      title: editTitle,
      description: editDesc,
      station: editStation,
      category: editCategory,
      priority: editPriority,
      assigneeId: editAssignee,
      assigneeName: assigneeObj ? assigneeObj.name : 'Sin asignar',
      clientId: editClient || activeTicket.clientId,
      clientName: clientObj ? clientObj.commercialName : activeTicket.clientName,
      imageUrl: editImage
    });

    setIsEditing(false);
  };

  const toSafeLower = (val) => (val ? String(val).toLowerCase() : '');

  const getPrincipalServer = (client) => {
    const servers = client?.infrastructure?.servers || [];
    if (servers.length === 0) return null;
    let mainSrv = servers.find(s => {
      const name = toSafeLower(s?.name);
      const type = toSafeLower(s?.type);
      return name.includes('principal') || type.includes('principal') || name.includes('main') || type.includes('main');
    });
    if (mainSrv) return mainSrv;
    mainSrv = servers.find(s => {
      const name = toSafeLower(s?.name);
      return name.includes('servidor') || name.includes('server');
    });
    if (mainSrv) return mainSrv;
    return servers[0];
  };

  if (!db) return null;

  // Filtering - Null Safe
  const filteredTickets = (db.tickets || []).filter(t => {
    if (!t) return false;
    const query = toSafeLower(searchQuery);
    const matchesSearch = !query ||
                          toSafeLower(t.title).includes(query) || 
                          toSafeLower(t.id).includes(query) ||
                          toSafeLower(t.clientName).includes(query) ||
                          toSafeLower(t.category).includes(query) ||
                          toSafeLower(t.description).includes(query);
    const matchesStatus = filterStatus === 'Todos' || t.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Add Ticket submit
  const handleAddTicketSubmit = (e) => {
    e.preventDefault();
    if (!tckTitle || !tckClient) return;

    const clientObj = db.clients.find(c => c.id === tckClient);
    const assigneeObj = db.employees.find(emp => emp.id === tckAssignee);

    const newTckId = addTicket({
      clientId: tckClient,
      clientName: clientObj ? clientObj.commercialName : 'Sin asignar',
      category: tckCategory,
      priority: tckPriority,
      title: tckTitle,
      description: tckDesc,
      station: tckStation,
      assigneeId: tckAssignee,
      assigneeName: assigneeObj ? assigneeObj.name : 'Sin asignar',
      solution: '',
      imageUrl: tckImage
    });

    if (newTckId) {
      setSelectedTicketId(newTckId);
    }

    setTckTitle('');
    setTckDesc('');
    setTckStation('');
    setTckCategory(db?.ticketCategories?.[0] || 'Soporte de Software');
    setTckClientSearch('');
    setTckClient('');
    setTckImage('');
    setShowNewCat(false);
    setNewCatName('');
    setShowAddTicket(false);
  };

  // Update Status & Log Comment
  const handleStatusUpdate = (e) => {
    e.preventDefault();
    if (!activeTicket || !nextStatus) return;

    updateTicketStatus(activeTicket.id, nextStatus, tckComment);
    setTckComment('');
    setNextStatus('');
    setSelectedTicketId(activeTicket.id);
  };

  const handleSimulateWhatsAppTicket = async () => {
    try {
      const sampleImg = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200"><rect width="400" height="200" fill="%230f62fe"/><text x="50%" y="45%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-size="18" font-family="sans-serif" font-weight="bold">📷 Falla de Impresora Fiscal / Captura</text><text x="50%" y="65%" dominant-baseline="middle" text-anchor="middle" fill="%23ffffff" font-size="14" font-family="sans-serif">Mensaje WhatsApp 001 - %2B584141234567</text></svg>';
      
      const res = await fetch(getApiUrl('/api/webhook/whatsapp'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: '584141234567',
          senderName: 'Cliente Ejemplo WhatsApp',
          messageText: '001 Falla en comunicación con impresora fiscal y punto de venta',
          photoUrl: sampleImg
        })
      });

      if (res.ok) {
        const data = await res.json();
        alert(`Operación exitosa: ${data.message}`);
        window.location.reload();
      } else {
        const errData = await res.json();
        alert(`Error en solicitud: ${errData.error}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="page-container" style={{ padding: '0 24px 24px 24px' }}>
      <div className="page-heading"><div><span className="eyebrow">SERVICIOS</span><h1>Centro de soporte</h1><p className="muted">Solicitudes, responsables y seguimiento de cada atención.</p></div><span className="status-pill">{filteredTickets.length} solicitudes</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', marginTop: '24px' }}>
        
        {/* Left Side: Ticket search and list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => setShowAddTicket(true)} style={{ width: '100%' }}>
              + Abrir Ticket
            </button>
            <button className="btn btn-secondary" onClick={handleSimulateWhatsAppTicket} style={{ width: '100%', fontSize: '0.75rem' }} title="Probar la creación de ticket WhatsApp con prefijo 001, número de origen e imagen adjunta">
              Probar Ticket WhatsApp (001 + Imagen + Teléfono)
            </button>
            <input
              type="text"
              placeholder="Buscar ticket, ID o cliente..."
              className="form-input"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            <div className="form-group">
              <label className="form-label">Filtrar por Estado</label>
              <select className="form-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="Todos">Todos</option>
                <option value="Abierto">Abierto</option>
                <option value="Asignado">Asignado</option>
                <option value="En proceso">En proceso</option>
                <option value="Esperando respuesta">Esperando respuesta</option>
                <option value="Cerrado">Cerrado</option>
              </select>
            </div>
          </div>

          {/* Ticket list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
            {(() => {
              const sortedTickets = [...filteredTickets].sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D/g, '') || 0, 10);
                const numB = parseInt(b.id.replace(/\D/g, '') || 0, 10);
                return numB - numA;
              });
              return sortedTickets.map(t => (
                <div
                key={t.id}
                onClick={() => { setSelectedTicketId(t.id); setIsEditing(false); }}
                style={{
                  padding: '12px 16px',
                  backgroundColor: activeTicket && activeTicket.id === t.id ? 'var(--primary-glow)' : 'var(--card)',
                  border: `1px solid ${activeTicket && activeTicket.id === t.id ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--primary)' }}>{t.id}</span>
                  <span className={`badge ${t.priority === 'Urgente' ? 'badge-danger' : t.priority === 'Alta' ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: '0.6rem' }}>
                    {t.priority}
                  </span>
                </div>
                <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{t.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>{t.clientName}</span>
                  {(t.originPhone || t.senderPhone) && <span style={{ color: 'var(--success)', fontWeight: 500 }}>Tel: {t.originPhone || t.senderPhone}</span>}
                  <span style={{ color: 'var(--primary)' }}>{t.status}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.6875rem', color: 'var(--text-muted)', borderTop: '1px dashed var(--border)', paddingTop: '4px', marginTop: '2px' }}>
                  <span>Resp: {t.assigneeName || 'Sin asignar'}</span>
                  <span style={{ fontStyle: 'italic', fontSize: '0.65rem' }}>{t.category}</span>
                </div>
              </div>
            ));
          })()}
          </div>
        </div>

        {/* Right Side: Ticket Details and Log History */}
        {activeTicket ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Banner card */}
            <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <span className="badge badge-primary">{activeTicket.category}</span>
                  <span className="badge badge-info">{activeTicket.status}</span>
                </div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 600, letterSpacing: '-0.02em' }}>{activeTicket.title}</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  ID: <strong>{activeTicket.id}</strong> | Cliente: <strong>{activeTicket.clientName}</strong> {(activeTicket.originPhone || activeTicket.senderPhone) ? <>| Teléfono Origen: <strong style={{ color: 'var(--primary)' }}>{activeTicket.originPhone || activeTicket.senderPhone}</strong> </> : ''} {activeTicket.station ? <>| Estación: <strong>{activeTicket.station}</strong> </> : ''} | Asignado a: <strong>{activeTicket.assigneeName}</strong>{activeTicket.status === 'Cerrado' && activeTicket.closedBy && <> | Finalizado por: <strong>{activeTicket.closedBy}</strong></>}
                  {(() => {
                    const clientObj = db.clients.find(c => c.id === activeTicket.clientId);
                    const principalServer = getPrincipalServer(clientObj);
                    if (principalServer && principalServer.anydesk) {
                      return (
                        <>
                          {' '}| AnyDesk Principal: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace' }}>{principalServer.anydesk}</strong>
                        </>
                      );
                    }
                    return null;
                  })()}
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.8125rem' }}>
                <div><strong>Apertura:</strong> {activeTicket.createdAt}</div>
                <div style={{ marginTop: '8px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {(currentUser.role === 'Administrador' || currentUser.role === 'Gerente' || currentUser.id === 'emp-master') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Asignar a:</span>
                      <select
                        value={activeTicket.assigneeId || ''}
                        onChange={e => {
                          reassignTicket(activeTicket.id, e.target.value);
                        }}
                        className="form-select"
                        style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                      >
                        <option value="">Seleccione técnico...</option>
                        {db.employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {!isEditing && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ borderColor: 'var(--primary)', color: 'var(--primary)', padding: '6px 10px', fontSize: '0.75rem', minWidth: 'auto' }}
                      onClick={() => {
                        setEditTitle(activeTicket.title);
                        setEditDesc(activeTicket.description);
                        setEditClient(activeTicket.clientId || '');
                        setEditStation(activeTicket.station || '');
                        setEditCategory(activeTicket.category);
                        setEditPriority(activeTicket.priority);
                        setEditAssignee(activeTicket.assigneeId || '');
                        setEditImage(activeTicket.imageUrl || activeTicket.photoUrl || '');
                        setIsEditing(true);
                      }}
                    >
                      Editar Info / Reasignar Cliente
                    </button>
                  )}
                  {activeTicket.status !== 'Cerrado' && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      style={{ borderColor: 'var(--success)', color: 'var(--success)', padding: '6px 10px', fontSize: '0.75rem', minWidth: 'auto' }}
                      onClick={() => setNextStatus('Cerrado')}
                    >
                      Finalizar Ticket
                    </button>
                  )}
                  <select
                    value={nextStatus || activeTicket.status}
                    onChange={e => {
                      setNextStatus(e.target.value);
                    }}
                    className="form-select"
                    style={{ padding: '6px 12px', fontSize: '0.75rem', width: 'auto' }}
                  >
                    <option value="">Cambiar estado...</option>
                    <option value="Abierto">Abierto</option>
                    <option value="Asignado">Asignado</option>
                    <option value="En proceso">En proceso</option>
                    <option value="Esperando respuesta">Esperando respuesta</option>
                    <option value="Cerrado">Cerrado</option>
                  </select>
                </div>
              </div>
            </div>

            {isEditing ? (
              <form onSubmit={handleSaveEdit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--primary)' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                   Editar Detalles y Reasignar Cliente del Ticket {activeTicket.id}
                </h3>
                
                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Título del Problema *</label>
                    <input
                      type="text"
                      className="form-input"
                      required
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label"> Reasignar a otro Cliente *</label>
                    <select
                      className="form-select"
                      value={editClient}
                      onChange={e => setEditClient(e.target.value)}
                    >
                      {(db.clients || []).map(c => (
                        <option key={c.id} value={c.id}>{c.commercialName}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select
                      className="form-select"
                      value={editCategory}
                      onChange={e => setEditCategory(e.target.value)}
                    >
                      {(db.ticketCategories || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Prioridad / Gravedad</label>
                    <select
                      className="form-select"
                      value={editPriority}
                      onChange={e => setEditPriority(e.target.value)}
                    >
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Estación / Caja</label>
                    <input
                      type="text"
                      className="form-input"
                      value={editStation}
                      onChange={e => setEditStation(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Asignar Responsable</label>
                    <select
                      className="form-select"
                      value={editAssignee}
                      onChange={e => setEditAssignee(e.target.value)}
                    >
                      <option value="">Seleccione técnico...</option>
                      {db.employees.map(emp => (
                        <option key={emp.id} value={emp.id}>{emp.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Descripción Detallada del Fallo</label>
                  <textarea
                    rows="4"
                    className="form-textarea"
                    required
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Imagen de la Falla (Opcional - Máx. 3 MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        alert('La imagen supera el límite de 3 MB. Por favor, suba un archivo más liviano.');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => setEditImage(event.target.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {editImage && (
                    <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                      <img src={editImage} alt="Edit preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                      <button 
                        type="button" 
                        onClick={() => setEditImage('')}
                        style={{
                          position: 'absolute', top: '4px', right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                          borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Description card */}
                <div className="card">
                  <h3 style={{ fontSize: '0.9375rem', marginBottom: '10px' }}>Descripción de la Falla</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: '1.6', backgroundColor: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                    {activeTicket.description}
                  </p>
                  
                  {activeTicketImg && (
                    <div style={{ marginTop: '16px' }}>
                      <h4 style={{ fontSize: '0.8125rem', marginBottom: '8px', color: 'var(--text)' }}> Imagen / Captura de Pantalla Adjunta:</h4>
                      <div style={{
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        backgroundColor: '#000000',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        padding: '8px'
                      }}>
                        <img 
                          src={activeTicketImg} 
                          alt="Falla" 
                          style={{ 
                            maxWidth: '100%', 
                            maxHeight: '400px', 
                            objectFit: 'contain',
                            cursor: 'zoom-in'
                          }} 
                          onClick={() => setLightboxImg(activeTicketImg)}
                          title="Haga clic para abrir en tamaño completo"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Solution card if closed/resolved */}
                {activeTicket.solution && (
                  <div className="card" style={{ border: '1px solid var(--success)', backgroundColor: 'rgba(0, 230, 115, 0.05)', marginTop: '-12px' }}>
                    <h3 style={{ fontSize: '0.9375rem', marginBottom: '10px', color: 'var(--success)' }}>✓ Solución Aplicada</h3>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text)', lineHeight: '1.6', backgroundColor: 'var(--background)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
                      {activeTicket.solution}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Status change Comment Form (Only when state is selected) */}
            {nextStatus && (
              <form onSubmit={handleStatusUpdate} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--warning)' }}>
                <h3 style={{ fontSize: '0.9375rem', color: 'var(--warning)' }}>Actualizar Estado a "{nextStatus}"</h3>
                <div className="form-group">
                  <label className="form-label">Comentario o reporte de diagnóstico (Requerido)</label>
                  <input
                    type="text"
                    placeholder="Escriba los detalles de la acción tomada..."
                    className="form-input"
                    required
                    value={tckComment}
                    onChange={e => setTckComment(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setNextStatus('')}>Cancelar</button>
                  <button type="submit" className="btn btn-primary">Aplicar Cambio</button>
                </div>
              </form>
            )}

            {/* Encuesta de Calidad CSAT / Rating de Satisfacción */}
            {(activeTicket.status === 'Resuelto' || activeTicket.status === 'Cerrado') && (
              <div className="card" style={{ backgroundColor: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.3)' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '0.9375rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: '6px' }}>
                   Encuesta de Calidad de Soporte (CSAT)
                </h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                  Por favor evalúe la atención y solución técnica brindada en este ticket:
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      type="button"
                      className="btn"
                      onClick={() => rateTicketCsat(activeTicket.id, star)}
                      style={{
                        padding: '6px 14px',
                        fontSize: '1.25rem',
                        backgroundColor: (activeTicket.csatRating || 0) >= star ? '#f59e0b' : 'var(--background)',
                        color: (activeTicket.csatRating || 0) >= star ? '#ffffff' : 'var(--text-muted)',
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)'
                      }}
                      title={`Calificar ${star} de 5 estrellas`}
                    >
                      ★ {star}
                    </button>
                  ))}
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, marginLeft: '6px', color: 'var(--text)' }}>
                    {activeTicket.csatRating ? `Evaluación: ${activeTicket.csatRating} / 5 Estrellas` : 'Pendiente por calificar'}
                  </span>
                </div>
              </div>
            )}

            {/* History tracking list */}
            <div className="card">
              <h3 style={{ fontSize: '0.9375rem', marginBottom: '16px' }}>Historial y Bitácora de Incidencia</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeTicket.history.map((hist, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border)',
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--primary)' }}>{hist.user}</span>
                      <span>{hist.date}</span>
                    </div>
                    <span style={{ fontSize: '0.8125rem' }}>{hist.action}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No hay tickets cargados.
          </div>
        )}
      </div>

      {showAddTicket && (
        <Modal onClose={() => { setShowAddTicket(false); setTckClientSearch(''); setTckClient(''); }}>
            <div className="modal-header">
              <h3>Abrir Ticket de Soporte</h3>
              <button className="btn btn-secondary" onClick={() => { setShowAddTicket(false); setTckClientSearch(''); setTckClient(''); }} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleAddTicketSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título del Problema</label>
                  <input type="text" placeholder="ej. Error en base de datos al generar cierre fiscal" className="form-input" required value={tckTitle} onChange={e => setTckTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cliente Afectado</label>
                  <input
                    type="text"
                    placeholder="🔍 Buscar cliente..."
                    className="form-input"
                    value={tckClientSearch}
                    onChange={e => setTckClientSearch(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  <select className="form-select" required value={tckClient} onChange={e => setTckClient(e.target.value)}>
                    <option value="">Seleccione cliente...</option>
                    {db.clients
                      .filter(c => c.commercialName.toLowerCase().includes(tckClientSearch.toLowerCase()))
                      .sort((a, b) => a.commercialName.localeCompare(b.commercialName, 'es', { sensitivity: 'base' }))
                      .map(c => (
                        <option key={c.id} value={c.id}>{c.commercialName}</option>
                      ))
                    }
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estación / Caja (Opcional)</label>
                  <input type="text" placeholder="ej. Caja 1, Servidor de Ventas" className="form-input" value={tckStation} onChange={e => setTckStation(e.target.value)} />
                </div>
                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label className="form-label" style={{ margin: 0 }}>Categoría</label>
                      <button
                        type="button"
                        onClick={() => {
                          setShowNewCat(!showNewCat);
                          setNewCatName('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--primary)',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                          fontWeight: 500,
                          padding: 0
                        }}
                      >
                        {showNewCat ? '✕ Cancelar' : '+ Nueva'}
                      </button>
                    </div>

                    {showNewCat ? (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input
                          type="text"
                          placeholder="Nombre de categoría"
                          className="form-input"
                          value={newCatName}
                          onChange={e => setNewCatName(e.target.value)}
                          style={{ flex: 1, padding: '4px 8px', fontSize: '0.8125rem' }}
                        />
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => {
                            if (newCatName.trim()) {
                              addTicketCategory(newCatName.trim());
                              setTckCategory(newCatName.trim());
                              setNewCatName('');
                              setShowNewCat(false);
                            }
                          }}
                          style={{ padding: '4px 10px', minWidth: 'auto', fontSize: '0.8125rem' }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : (
                      <select className="form-select" value={tckCategory} onChange={e => setTckCategory(e.target.value)}>
                        {(db.ticketCategories || []).map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gravedad / Prioridad</label>
                    <select className="form-select" value={tckPriority} onChange={e => setTckPriority(e.target.value)}>
                      <option value="Baja">Baja</option>
                      <option value="Media">Media</option>
                      <option value="Alta">Alta</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Asignar Responsable</label>
                  <select className="form-select" required value={tckAssignee} onChange={e => setTckAssignee(e.target.value)}>
                    <option value="">Seleccione técnico...</option>
                    {db.employees.map(emp => (
                      <option key={emp.id} value={emp.id}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Descripción Detallada del Fallo</label>
                  <textarea rows="4" placeholder="Indique logs de error, pasos para reproducir o equipos afectados..." className="form-textarea" required value={tckDesc} onChange={e => setTckDesc(e.target.value)}></textarea>
                </div>

                <div className="form-group">
                  <label className="form-label">Cargar Imagen de Error (Opcional - Máx. 3 MB)</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-input"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      if (file.size > 3 * 1024 * 1024) {
                        alert('La imagen supera el límite de 3 MB. Por favor, suba un archivo más liviano.');
                        e.target.value = '';
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = (event) => setTckImage(event.target.result);
                      reader.readAsDataURL(file);
                    }}
                  />
                  {tckImage && (
                    <div style={{ marginTop: '8px', position: 'relative', display: 'inline-block' }}>
                      <img src={tckImage} alt="Upload preview" style={{ maxWidth: '100%', maxHeight: '150px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
                      <button 
                        type="button" 
                        onClick={() => setTckImage('')}
                        style={{
                          position: 'absolute', top: '4px', right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                          borderRadius: '50%', width: '24px', height: '24px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </div>

                {/* Real-time Recurrence Warning */}
                {(() => {
                  const recurring = checkRecurringIssues(tckClient, tckStation, tckDesc);
                  if (recurring.length === 0) return null;
                  return (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: 'rgba(230, 92, 0, 0.08)',
                      border: '1px dashed var(--warning)',
                      borderRadius: 'var(--radius-sm)'
                    }}>
                      <div style={{ color: 'var(--warning)', fontWeight: 500, fontSize: '0.8125rem', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span> Alerta de Falla Recurrente ({recurring.length})</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {recurring.map(issue => (
                          <div key={issue.id} style={{ fontSize: '0.75rem', borderLeft: '2px solid var(--warning)', paddingLeft: '8px' }}>
                            <div style={{ fontWeight: '600', color: 'var(--text)' }}>
                              {issue.id}: {issue.title} {issue.station ? `(${issue.station})` : ''}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Falla: {issue.description}</div>
                            <div style={{ color: 'var(--success)', marginTop: '2.5px', fontWeight: '500' }}>
                              <strong>Solución previa:</strong> {issue.solution}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => { setShowAddTicket(false); setTckClientSearch(''); setTckClient(''); }}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Emitir Ticket</button>
              </div>
            </form>
          </Modal>
        )}

      {/* Image Lightbox Modal */}
      {lightboxImg && (
        <ImageLightbox src={lightboxImg} onClose={() => setLightboxImg(null)} />
      )}
    </div>
  );
}
