import React, { useState, useContext } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';
import ImageLightbox from '../components/ImageLightbox';
import ReportShareModal from '../components/ReportShareModal';

// Sleek SVG Icons replacing emojis
const ReportIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const CameraIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', color: 'var(--primary)' }}>
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

const OcrIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="9" y1="9" x2="15" y2="9" />
    <line x1="9" y1="13" x2="15" y2="13" />
    <line x1="9" y1="17" x2="13" y2="17" />
  </svg>
);

const OcrButtonIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const TrashIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const EditIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const LinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const TicketIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v2z" />
    <line x1="13" y1="5" x2="13" y2="19" />
  </svg>
);

const CalendarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const FileIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '8px', color: 'var(--text-muted)' }}>
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
);

export default function ServiceReports() {
  const {
    db,
    currentUser,
    addServiceReport,
    updateServiceReport,
    deleteServiceReport,
    updateTicketDetails,
    setPendingTicket,
    setActiveTab
  } = useContext(AppContext);

  // Helper for current local datetime formatted for datetime-local input (YYYY-MM-DDTHH:MM)
  const getLocalDateTimeString = () => {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000;
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  // Form State (New Report)
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearchText, setClientSearchText] = useState('');
  const [workDetails, setWorkDetails] = useState('');
  const [reportDateTime, setReportDateTime] = useState(getLocalDateTimeString());
  const [reportImages, setReportImages] = useState([]); // array of base64 strings
  
  // OCR State
  const [ocrStatus, setOcrStatus] = useState(''); // 'idle', 'loading', 'recognizing', 'done', 'error'
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResultText, setOcrResultText] = useState('');
  const [ocrActiveImageIdx, setOcrActiveImageIdx] = useState(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [shareReport, setShareReport] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [lightboxImage, setLightboxImage] = useState(null);
  const [linkTicketReportId, setLinkTicketReportId] = useState(null);
  const [linkTicketSelectedImage, setLinkTicketSelectedImage] = useState('');
  const [linkTicketSelectedTicketId, setLinkTicketSelectedTicketId] = useState('');
  const [ticketSearchQuery, setTicketSearchQuery] = useState('');

  // Editing State
  const [editingReport, setEditingReport] = useState(null);
  const [editClientId, setEditClientId] = useState('');
  const [editClientSearchText, setEditClientSearchText] = useState('');
  const [editWorkDetails, setEditWorkDetails] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editImages, setEditImages] = useState([]);

  if (!db) return null;

  // Filter clients for dropdown
  const filteredClients = db.clients
    .filter(c => c.commercialName.toLowerCase().includes(clientSearchText.toLowerCase()))
    .sort((a, b) => a.commercialName.localeCompare(b.commercialName, 'es', { sensitivity: 'base' }));

  // Filter clients for edit dropdown
  const filteredEditClients = db.clients
    .filter(c => c.commercialName.toLowerCase().includes(editClientSearchText.toLowerCase()))
    .sort((a, b) => a.commercialName.localeCompare(b.commercialName, 'es', { sensitivity: 'base' }));

  // Filter reports
  const filteredReports = (db.serviceReports || []).filter(rep => {
    const matchesSearch = 
      rep.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.workDetails.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rep.createdBy.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Get active tickets for linking
  const activeTickets = (db.tickets || []).filter(t => t.status !== 'Cerrado');

  const compressImage = (base64Str, maxWidth = 1200, quality = 0.65) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        let width = img.width;
        let height = img.height;
        
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => {
        resolve(base64Str);
      };
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 8 * 1024 * 1024) {
        alert(`La imagen "${file.name}" supera el límite de 8 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const compressed = await compressImage(evt.target.result);
        setReportImages(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeUploadedImage = (index) => {
    setReportImages(prev => prev.filter((_, idx) => idx !== index));
    if (ocrActiveImageIdx === index) {
      resetOcrState();
    } else if (ocrActiveImageIdx > index) {
      setOcrActiveImageIdx(prev => prev - 1);
    }
  };

  const resetOcrState = () => {
    setOcrStatus('');
    setOcrProgress(0);
    setOcrResultText('');
    setOcrActiveImageIdx(null);
  };

  const runOcrOnImage = (imageSrc, idx) => {
    if (!window.Tesseract) {
      alert('La librería de OCR (Tesseract.js) no está disponible en este momento. Revisa tu conexión de red.');
      return;
    }

    setOcrActiveImageIdx(idx);
    setOcrStatus('loading');
    setOcrProgress(0);
    setOcrResultText('');

    window.Tesseract.recognize(
      imageSrc,
      'spa', // Spanish
      {
        logger: m => {
          if (m.status === 'recognizing text') {
            setOcrStatus('recognizing');
            setOcrProgress(Math.round(m.progress * 100));
          } else {
            setOcrStatus(m.status);
          }
        }
      }
    ).then(({ data: { text } }) => {
      setOcrStatus('done');
      setOcrProgress(100);
      setOcrResultText(text);
    }).catch(err => {
      console.error(err);
      setOcrStatus('error');
      alert('Error ejecutando el reconocimiento OCR: ' + err.message);
    });
  };

  const appendOcrToDetails = () => {
    if (!ocrResultText) return;
    setWorkDetails(prev => {
      const spacing = prev.trim() ? '\n\n--- Texto Reconocido ---\n' : '';
      return prev + spacing + ocrResultText.trim();
    });
  };

  const handleCreateReport = async (e) => {
    e.preventDefault();
    if (saving) return;
    if (!selectedClientId || !workDetails.trim()) {
      alert('Por favor selecciona un cliente y detalla el trabajo realizado.');
      return;
    }

    const client = db.clients.find(c => c.id === selectedClientId);
    if (!client) return;

    // Convert datetime-local YYYY-MM-DDTHH:MM to YYYY-MM-DD HH:MM
    const formattedDateTime = reportDateTime.replace('T', ' ');

    setSaving(true);
    setFormError('');
    try {
    const savedReport = await addServiceReport({
      clientId: selectedClientId,
      clientName: client.commercialName,
      workDetails: workDetails.trim(),
      images: reportImages,
      createdAt: formattedDateTime
    });

    // Reset form
    setSelectedClientId('');
    setClientSearchText('');
    setWorkDetails('');
    setReportImages([]);
    setReportDateTime(getLocalDateTimeString());
    resetOcrState();
    setShareReport(savedReport);
    } catch (err) { setFormError(err.message); }
    finally { setSaving(false); }
  };

  const handleDeleteReport = (reportId) => {
    if (window.confirm('¿Está seguro de que desea eliminar este reporte de servicio?')) {
      deleteServiceReport(reportId);
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (rep) => {
    setEditingReport(rep);
    setEditClientId(rep.clientId);
    setEditClientSearchText('');
    setEditWorkDetails(rep.workDetails);
    
    // Format YYYY-MM-DD HH:MM to YYYY-MM-DDTHH:MM
    const isoDateTime = rep.createdAt ? rep.createdAt.replace(' ', 'T') : getLocalDateTimeString();
    setEditDateTime(isoDateTime);
    setEditImages(rep.images || []);
  };

  const handleEditImageUpload = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    files.forEach(file => {
      if (file.size > 8 * 1024 * 1024) {
        alert(`La imagen "${file.name}" supera el límite de 8 MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = async (evt) => {
        const compressed = await compressImage(evt.target.result);
        setEditImages(prev => [...prev, compressed]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const removeEditUploadedImage = (index) => {
    setEditImages(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateReportSubmit = (e) => {
    e.preventDefault();
    if (!editClientId || !editWorkDetails.trim()) {
      alert('Por favor selecciona un cliente y detalla el trabajo realizado.');
      return;
    }

    const client = db.clients.find(c => c.id === editClientId);
    if (!client) return;

    updateServiceReport(editingReport.id, {
      clientId: editClientId,
      clientName: client.commercialName,
      workDetails: editWorkDetails.trim(),
      createdAt: editDateTime.replace('T', ' '),
      images: editImages
    });

    setEditingReport(null);
    alert('Reporte de servicio actualizado exitosamente.');
  };

  // Link image to ticket
  const handleLinkImageToTicketSubmit = (e) => {
    e.preventDefault();
    if (!linkTicketSelectedTicketId || !linkTicketSelectedImage) {
      alert('Seleccione un ticket y una imagen para vincular.');
      return;
    }

    const ticket = db.tickets.find(t => t.id === linkTicketSelectedTicketId);
    if (!ticket) return;

    // Update ticket image URL
    updateTicketDetails(ticket.id, {
      imageUrl: linkTicketSelectedImage
    });
    
    alert(`Imagen vinculada correctamente al ticket ${ticket.id} (${ticket.title})`);
    setLinkTicketReportId(null);
    setLinkTicketSelectedImage('');
    setLinkTicketSelectedTicketId('');
    setTicketSearchQuery('');
  };

  // Pre-fill ticket and redirect
  const handleCreateTicketFromReport = (report, imageSrc) => {
    setPendingTicket({
      clientId: report.clientId,
      title: `Reporte de Servicio - ${report.clientName}`,
      description: `Detalles del trabajo realizado:\n${report.workDetails}`,
      imageUrl: imageSrc
    });
    setActiveTab('tickets');
  };

  return (
    <div className="service-reports">
      <div className="page-heading"><div><span className="eyebrow">ATENCIÓN AL CLIENTE</span><h1>Reportes de servicio</h1><p className="muted">Registra el trabajo y entrega al cliente su reporte en PDF.</p></div></div>
      
      {/* Upper Panel: New Report registration & OCR */}
      <div className="report-editor-grid">
        
        {/* Form Column */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ReportIcon /> Registrar Reporte de Servicio
          </h2>
          
          <form onSubmit={handleCreateReport} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Client selection with search */}
            <div className="form-group">
              <label className="form-label">Cliente Afectado</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar cliente..."
                    className="form-input"
                    value={clientSearchText}
                    onChange={e => setClientSearchText(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                </div>
                <select
                  className="form-select"
                  required
                  value={selectedClientId}
                  onChange={e => setSelectedClientId(e.target.value)}
                >
                  <option value="">Seleccione el cliente...</option>
                  {filteredClients.map(c => (
                    <option key={c.id} value={c.id}>{c.commercialName}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date and Time custom field */}
            <div className="form-group">
              <label className="form-label">Fecha y Hora del Reporte</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                  <CalendarIcon />
                </span>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={reportDateTime}
                  onChange={e => setReportDateTime(e.target.value)}
                  required
                  style={{ paddingLeft: '34px' }}
                />
              </div>
            </div>

            {/* Photos upload */}
            <div className="form-group">
              <label className="form-label">Subir Fotos de la Hoja de Reporte (Máx 4MB por foto)</label>
              <div style={{
                border: '2px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '24px 16px',
                textAlign: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                />
                <CameraIcon />
                <span style={{ fontSize: '0.85rem', display: 'block', color: 'var(--text)', fontWeight: 500 }}>
                  Seleccionar o arrastrar fotos del reporte
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                  Formatos JPG, PNG
                </span>
              </div>

              {/* Preview uploaded images */}
              {reportImages.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
                  {reportImages.map((img, idx) => (
                    <div
                      key={idx}
                      style={{
                        position: 'relative',
                        width: '80px',
                        height: '80px',
                        borderRadius: 'var(--radius-sm)',
                        overflow: 'hidden',
                        border: ocrActiveImageIdx === idx ? '2px solid var(--warning)' : '1px solid var(--border)',
                        boxShadow: ocrActiveImageIdx === idx ? '0 0 10px rgba(245, 158, 11, 0.4)' : 'none'
                      }}
                    >
                      <img
                        src={img}
                        alt={`Report ${idx}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={() => removeUploadedImage(idx)}
                        style={{
                          position: 'absolute', top: '4px', right: '4px',
                          backgroundColor: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none',
                          borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem'
                        }}
                        title="Quitar imagen"
                      >
                        ✕
                      </button>
                      <button
                        type="button"
                        onClick={() => runOcrOnImage(img, idx)}
                        style={{
                          position: 'absolute', bottom: '4px', left: '4px', right: '4px',
                          backgroundColor: 'var(--primary)', color: '#fff', border: 'none',
                          borderRadius: '4px', fontSize: '0.55rem', cursor: 'pointer',
                          padding: '3px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500
                        }}
                        title="Reconocer texto"
                      >
                        <OcrButtonIcon /> OCR
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Work Details */}
            <div className="form-group">
              <label className="form-label">Detalles del Trabajo Realizado</label>
              <textarea
                className="form-textarea"
                rows="6"
                placeholder="Describa el trabajo realizado detalladamente o use el lector OCR para extraer el texto automáticamente de la hoja..."
                value={workDetails}
                onChange={e => setWorkDetails(e.target.value)}
                required
              />
            </div>

            {formError && <p className="notice error" role="alert">{formError}</p>}
            <button type="submit" disabled={saving} className="btn btn-primary" style={{ width: '100%' }}>
              {saving ? 'Guardando reporte…' : 'Guardar y preparar PDF'}
            </button>
          </form>
        </div>

        {/* OCR Result Column */}
        <div className="card" style={{ height: '100%', minHeight: '380px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, borderBottom: '1px solid var(--border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <OcrIcon /> Lector OCR de Reporte Físico
          </h3>

          {ocrActiveImageIdx !== null ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img
                  src={reportImages[ocrActiveImageIdx]}
                  alt="OCR Target"
                  style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                />
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 500 }}>Analizando imagen #{ocrActiveImageIdx + 1}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Estado: {ocrStatus}</div>
                </div>
              </div>

              {/* Progress Bar */}
              {(ocrStatus === 'loading' || ocrStatus === 'recognizing' || ocrStatus.includes('load')) && (
                <div style={{ width: '100%' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7Gram', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    <span>Procesando...</span>
                    <span>{ocrProgress}%</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ocrProgress}%`, backgroundColor: 'var(--warning)', transition: 'width 0.1s ease' }} />
                  </div>
                </div>
              )}

              {/* OCR Result Box */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.75rem' }}>Texto Extraído (Reconocido):</label>
                <textarea
                  className="form-textarea"
                  style={{ flex: 1, fontFamily: 'monospace', fontSize: '0.8rem', backgroundColor: 'var(--background)', color: 'var(--warning)' }}
                  value={ocrResultText}
                  onChange={e => setOcrResultText(e.target.value)}
                  placeholder="El texto de la hoja aparecerá aquí..."
                  readOnly={ocrStatus !== 'done'}
                />

                {ocrStatus === 'done' && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={appendOcrToDetails}
                    style={{ borderColor: 'var(--warning)', color: 'var(--warning)', alignSelf: 'flex-end', fontSize: '0.8rem', padding: '6px 12px' }}
                  >
                    Volcar a Trabajo Realizado
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', textAlign: 'center', padding: '24px' }}>
              <FileIcon />
              <p style={{ fontSize: '0.85rem', lineHeight: '1.5', margin: 0 }}>
                Presione el botón <strong>OCR</strong> en cualquiera de las miniaturas de fotos cargadas a la izquierda para extraer automáticamente su texto.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Lower Panel: Saved Reports History */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ReportIcon /> Historial de Reportes de Servicio
          </h2>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '300px' }}>
            <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Buscar por cliente, detalle o técnico..."
              className="form-input"
              style={{ paddingLeft: '34px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {filteredReports.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
            {filteredReports.map(rep => (
              <div
                key={rep.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'var(--background)',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500, color: 'var(--warning)' }}>
                      {rep.clientName}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      ID: {rep.id} | Creado por: <strong>{rep.createdBy}</strong> | Fecha: {rep.createdAt}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="report-actions">
                    <button className="btn btn-primary" onClick={() => setShareReport(rep)}>PDF / WhatsApp</button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => handleOpenEditModal(rep)}
                      style={{
                        padding: '4px 8px', fontSize: '0.75rem', color: 'var(--primary)', borderColor: 'rgba(59, 130, 246, 0.25)', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                      }}
                    >
                      <EditIcon /> Editar
                    </button>
                    {(currentUser.role === 'Administrador' || currentUser.id === rep.createdById) && (
                      <button
                        className="btn btn-secondary"
                        onClick={() => handleDeleteReport(rep.id)}
                        style={{
                          padding: '4px 8px', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'rgba(239, 68, 68, 0.25)', minWidth: 'auto', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <TrashIcon /> Eliminar
                      </button>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div style={{
                  fontSize: '0.85rem',
                  lineHeight: '1.5',
                  backgroundColor: 'rgba(255, 255, 255, 0.015)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text)',
                  border: '1px solid rgba(255, 255, 255, 0.03)'
                }}>
                  {rep.workDetails}
                </div>

                {/* Image gallery & actions */}
                {rep.images && rep.images.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      {rep.images.map((img, imgIdx) => (
                        <div key={imgIdx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div
                            onClick={() => setLightboxImage({ images: rep.images, index: imgIdx })}
                            style={{
                              width: '100px',
                              height: '100px',
                              borderRadius: 'var(--radius-sm)',
                              overflow: 'hidden',
                              border: '1px solid var(--border)',
                              cursor: 'zoom-in',
                              backgroundColor: '#000'
                            }}
                          >
                            <img
                              src={img}
                              alt={`Report doc ${imgIdx}`}
                              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.2s' }}
                              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
                              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
                            />
                          </div>
                          
                          {/* Image specific actions */}
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => {
                                setLinkTicketReportId(rep.id);
                                setLinkTicketSelectedImage(img);
                                setLinkTicketSelectedTicketId('');
                              }}
                              style={{ padding: '3px 6px', fontSize: '0.65rem', minWidth: 'auto', flex: 1, borderColor: 'rgba(59, 130, 246, 0.2)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            >
                              <LinkIcon /> Vincular
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => handleCreateTicketFromReport(rep, img)}
                              style={{ padding: '3px 6px', fontSize: '0.65rem', minWidth: 'auto', flex: 1, borderColor: 'rgba(16, 185, 129, 0.2)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}
                            >
                              <TicketIcon /> Ticket
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            No se encontraron reportes de servicio cargados.
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {lightboxImage && (
        <ImageLightbox
          images={lightboxImage?.images}
          initialIndex={lightboxImage?.index}
          src={typeof lightboxImage === 'string' ? lightboxImage : null}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* Link Image to Ticket Modal */}
      {linkTicketReportId && (
        <Modal onClose={() => setLinkTicketReportId(null)}>
          <div className="modal-header">
            <h3 style={{ fontSize: '1rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LinkIcon /> Vincular Imagen a Ticket Existente
            </h3>
            <button className="btn btn-secondary" onClick={() => setLinkTicketReportId(null)} style={{ padding: '4px 8px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleLinkImageToTicketSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <img
                  src={linkTicketSelectedImage}
                  alt="Selected attachment"
                  style={{ width: '80px', height: '80px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Seleccione un ticket activo para asociar esta imagen. La imagen se guardará como la captura de falla del ticket.
                </div>
              </div>

              {/* Search tickets */}
              <div className="form-group">
                <label className="form-label">Buscar Ticket de Soporte Activo</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%', marginBottom: '8px' }}>
                  <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <SearchIcon />
                  </span>
                  <input
                    type="text"
                    placeholder="Buscar por ID, título o cliente..."
                    className="form-input"
                    value={ticketSearchQuery}
                    onChange={e => setTicketSearchQuery(e.target.value)}
                    style={{ paddingLeft: '34px' }}
                  />
                </div>
                
                <select
                  className="form-select"
                  required
                  value={linkTicketSelectedTicketId}
                  onChange={e => setLinkTicketSelectedTicketId(e.target.value)}
                  size="6"
                  style={{ height: 'auto', minHeight: '120px' }}
                >
                  <option value="" disabled>-- Seleccione un Ticket Activo --</option>
                  {activeTickets
                    .filter(t => 
                      t.title.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
                      t.id.toLowerCase().includes(ticketSearchQuery.toLowerCase()) ||
                      t.clientName.toLowerCase().includes(ticketSearchQuery.toLowerCase())
                    )
                    .map(t => (
                      <option key={t.id} value={t.id}>
                        [{t.id}] {t.clientName} - {t.title} ({t.status})
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setLinkTicketReportId(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Vincular Imagen</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Report Modal */}
      {editingReport && (
        <Modal onClose={() => setEditingReport(null)}>
          <div className="modal-header">
            <h3 style={{ fontSize: '1.05rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <EditIcon /> Editar Reporte de Servicio
            </h3>
            <button className="btn btn-secondary" onClick={() => setEditingReport(null)} style={{ padding: '4px 8px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleUpdateReportSubmit}>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Client Selection */}
              <div className="form-group">
                <label className="form-label">Cliente Afectado</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                      <SearchIcon />
                    </span>
                    <input
                      type="text"
                      placeholder="Buscar cliente..."
                      className="form-input"
                      value={editClientSearchText}
                      onChange={e => setEditClientSearchText(e.target.value)}
                      style={{ paddingLeft: '34px' }}
                    />
                  </div>
                  <select
                    className="form-select"
                    required
                    value={editClientId}
                    onChange={e => setEditClientId(e.target.value)}
                  >
                    <option value="">Seleccione el cliente...</option>
                    {filteredEditClients.map(c => (
                      <option key={c.id} value={c.id}>{c.commercialName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date and Time custom field */}
              <div className="form-group">
                <label className="form-label">Fecha y Hora del Reporte</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '12px', display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}>
                    <CalendarIcon />
                  </span>
                  <input
                    type="datetime-local"
                    className="form-input"
                    value={editDateTime}
                    onChange={e => setEditDateTime(e.target.value)}
                    required
                    style={{ paddingLeft: '34px' }}
                  />
                </div>
              </div>

              {/* Photos upload & gallery in edit modal */}
              <div className="form-group">
                <label className="form-label">Subir Nuevas Fotos (Máx 4MB por foto)</label>
                <div style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.01)',
                  cursor: 'pointer',
                  position: 'relative'
                }}>
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleEditImageUpload}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0,
                      cursor: 'pointer'
                    }}
                  />
                  <CameraIcon />
                  <span style={{ fontSize: '0.8rem', display: 'block', color: 'var(--text-muted)' }}>
                    Haga clic para agregar más imágenes
                  </span>
                </div>

                {/* Edit gallery preview */}
                {editImages.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '12px' }}>
                    {editImages.map((img, idx) => (
                      <div
                        key={idx}
                        style={{
                          position: 'relative',
                          width: '60px',
                          height: '60px',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid var(--border)'
                        }}
                      >
                        <img
                          src={img}
                          alt={`Edit report ${idx}`}
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                        <button
                          type="button"
                          onClick={() => removeEditUploadedImage(idx)}
                          style={{
                            position: 'absolute', top: '2px', right: '2px',
                            backgroundColor: 'rgba(0,0,0,0.8)', color: '#fff', border: 'none',
                            borderRadius: '50%', width: '16px', height: '16px', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Work Details */}
              <div className="form-group">
                <label className="form-label">Detalles del Trabajo Realizado</label>
                <textarea
                  className="form-textarea"
                  rows="5"
                  value={editWorkDetails}
                  onChange={e => setEditWorkDetails(e.target.value)}
                  required
                />
              </div>

            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setEditingReport(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary">Actualizar Reporte</button>
            </div>
          </form>
        </Modal>
      )}

      {shareReport && <ReportShareModal report={shareReport} onClose={() => setShareReport(null)} />}
    </div>
  );
}
