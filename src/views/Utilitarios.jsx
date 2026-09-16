import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Utilitarios() {
  const { db, addUtilityFile, deleteUtilityFile, currentUser } = useContext(AppContext);
  
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [inlinePreviewFileId, setInlinePreviewFileId] = useState(null);

  // Form State
  const [fileName, setFileName] = useState('');
  const [fileDesc, setFileDesc] = useState('');
  const [fileCategory, setFileCategory] = useState('Otros');
  const [fileType, setFileType] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [fileDataUrl, setFileDataUrl] = useState('');
  const [uploadError, setUploadError] = useState('');

  if (!db) return null;

  const categories = ['Todos', 'Instaladores', 'Drivers', 'Scripts', 'Manuales / PDFs', 'Backups', 'Otros'];

  // Filtering files
  const filteredFiles = (db.utilitarios || []).filter(file => {
    const matchesSearch = 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (file.description && file.description.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'Todos' || file.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const handleFileChange = (e) => {
    setUploadError('');
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit (10 MB = 10 * 1024 * 1024 bytes)
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('El archivo supera el límite de 10 MB. Por favor, suba un archivo más liviano.');
      e.target.value = ''; // clear input
      return;
    }

    setFileName(file.name);
    
    // Guess type
    let guessedType = file.type || 'Archivo';
    if (!file.type && file.name.includes('.')) {
      const ext = file.name.split('.').pop().toUpperCase();
      guessedType = `${ext} File`;
    }
    setFileType(guessedType);

    // Human readable size
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(2);
    setFileSize(sizeInMb > 0.1 ? `${sizeInMb} MB` : `${(file.size / 1024).toFixed(2)} KB`);

    // Guess category from name
    const ext = file.name.split('.').pop().toLowerCase();
    if (['exe', 'msi'].includes(ext)) {
      setFileCategory('Instaladores');
    } else if (['inf', 'sys', 'dll'].includes(ext)) {
      setFileCategory('Drivers');
    } else if (['bat', 'cmd', 'ps1', 'sh', 'vbs', 'py', 'js'].includes(ext)) {
      setFileCategory('Scripts');
    } else if (['pdf', 'docx', 'xlsx', 'txt', 'md'].includes(ext)) {
      setFileCategory('Manuales / PDFs');
    } else if (['sql', 'bak', 'zip', 'rar'].includes(ext)) {
      setFileCategory('Backups');
    } else {
      setFileCategory('Otros');
    }

    // Read to Base64
    const reader = new FileReader();
    reader.onload = (evt) => {
      setFileDataUrl(evt.target.result);
    };
    reader.onerror = () => {
      setUploadError('Error al leer el archivo físico.');
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!fileName || !fileDataUrl) {
      setUploadError('Debe seleccionar un archivo para subir.');
      return;
    }

    addUtilityFile({
      name: fileName,
      description: fileDesc,
      category: fileCategory,
      type: fileType,
      size: fileSize,
      dataUrl: fileDataUrl
    });

    // Reset Form
    setFileName('');
    setFileDesc('');
    setFileCategory('Otros');
    setFileType('');
    setFileSize('');
    setFileDataUrl('');
    setUploadError('');
    setShowUploadModal(false);
  };

  const handleDeleteClick = (fileId, name) => {
    if (!window.confirm(`¿Está seguro de que desea eliminar el utilitario "${name}"?`)) return;
    deleteUtilityFile(fileId);
    if (inlinePreviewFileId === fileId) {
      setInlinePreviewFileId(null);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (ext === 'pdf') return '📕';
    if (['zip', 'rar', 'tar', 'gz', '7z', 'cab'].includes(ext)) return '📦';
    if (['exe', 'msi', 'bat', 'cmd', 'ps1', 'sh', 'vbs', 'py', 'js'].includes(ext)) return '⚙️';
    if (['sql', 'bak'].includes(ext)) return '💾';
    if (['txt', 'md', 'log'].includes(ext)) return '📝';
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) return '🖼️';
    return '📄';
  };

  return (
    <div className="page-container" style={{ padding: '0 24px 24px 24px' }}>
      <div className="wiki-grid">
        
        {/* Left Side: Filter and actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => setShowUploadModal(true)} style={{ width: '100%' }}>
              + Subir Utilitario
            </button>
            
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Buscar Archivo</label>
              <input
                type="text"
                placeholder="Buscar por nombre o nota..."
                className="form-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ fontSize: '0.8125rem' }}
              />
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Filtrar por Categoría</label>
              <select
                className="form-select"
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '0.8125rem' }}
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Side: Grid of files */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {filteredFiles.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              No se encontraron archivos utilitarios en esta categoría.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {filteredFiles.map(file => {
                const isMaster = currentUser?.role === 'Administrador' || currentUser?.id === 'emp-master';
                const isAuthor = currentUser?.id === file.authorId;
                const canDelete = isMaster || isAuthor;
                const isPreviewOpen = inlinePreviewFileId === file.id;

                return (
                  <div key={file.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div 
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '12px',
                        height: '100%',
                        position: 'relative'
                      }}
                    >
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <div style={{ fontSize: '2.25rem', lineHeight: '1', flexShrink: 0 }}>
                          {getFileIcon(file.name)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <span className="badge badge-primary" style={{ fontSize: '0.6rem', padding: '1px 6px', marginBottom: '4px' }}>
                            {file.category}
                          </span>
                          <h4 
                            style={{ 
                              fontSize: '0.9rem', 
                              fontWeight: 500, 
                              margin: '2px 0 0 0', 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }} 
                            title={file.name}
                          >
                            {file.name}
                          </h4>
                          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {file.description || 'Sin descripción.'}
                          </p>
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <span>Subido por: <strong>{file.author}</strong></span>
                          <span>Fecha: <strong>{file.uploadDate}</strong></span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          <span>Formato: <strong>{file.type ? file.type.split(';')[0].replace('application/', '').replace('image/', '') : 'Archivo'}</strong></span>
                          <span>Tamaño: <strong>{file.size}</strong></span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                        <button 
                          className="btn btn-secondary"
                          onClick={() => setInlinePreviewFileId(isPreviewOpen ? null : file.id)}
                          style={{ padding: '6px 12px', fontSize: '0.75rem', flex: 1 }}
                        >
                          {isPreviewOpen ? 'Contraer' : '👁️ Vista Previa'}
                        </button>
                        <a 
                          href={file.dataUrl} 
                          download={file.name}
                          className="btn btn-primary"
                          style={{ padding: '6px 12px', fontSize: '0.75rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                           Descargar
                        </a>
                        {canDelete && (
                          <button 
                            className="btn btn-secondary"
                            onClick={() => handleDeleteClick(file.id, file.name)}
                            style={{ 
                              padding: '6px 10px', 
                              backgroundColor: 'rgba(230, 92, 0, 0.1)', 
                              color: 'var(--danger)', 
                              borderColor: 'rgba(230, 92, 0, 0.2)' 
                            }}
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Inline preview */}
                    {isPreviewOpen && (
                      <div 
                        className="card"
                        style={{
                          padding: '12px',
                          backgroundColor: 'var(--background)',
                          border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 500, color: 'var(--primary)' }}>Contenido de {file.name}</span>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '2px 6px', fontSize: '0.6rem', minWidth: 'auto' }}
                            onClick={() => setInlinePreviewFileId(null)}
                          >
                            Ocultar
                          </button>
                        </div>
                        <div style={{
                          width: '100%',
                          minHeight: '150px',
                          maxHeight: '300px',
                          overflow: 'auto',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#000000',
                          border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius-xs)',
                          padding: '8px'
                        }}>
                          {file.dataUrl.startsWith('data:image/') || /\.(png|jpe?g|gif|svg|webp)$/i.test(file.name) ? (
                            <img src={file.dataUrl} alt={file.name} style={{ maxWidth: '100%', maxHeight: '280px', objectFit: 'contain' }} />
                          ) : file.dataUrl.startsWith('data:application/pdf') || /\.pdf$/i.test(file.name) ? (
                            <object data={file.dataUrl} type="application/pdf" width="100%" height="280px">
                              <div style={{ textAlign: 'center', padding: '10px' }}>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vista previa PDF no disponible.</p>
                                <a href={file.dataUrl} download={file.name} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>Descargar PDF</a>
                              </div>
                            </object>
                          ) : file.dataUrl.startsWith('data:text/') || /\.txt$/i.test(file.name) ? (
                             <pre style={{ width: '100%', fontSize: '0.75rem', color: 'var(--text)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', textAlign: 'left', margin: 0 }}>
                              {(() => {
                                try {
                                  const base64Str = file.dataUrl.split(',')[1] || '';
                                  return decodeURIComponent(escape(atob(base64Str)));
                                } catch (e) {
                                  try {
                                    return atob(file.dataUrl.split(',')[1] || '');
                                  } catch (e2) {
                                    return 'No se puede previsualizar el contenido de este archivo de texto.';
                                  }
                                }
                              })()}
                            </pre>
                          ) : (
                            <div style={{ textAlign: 'center', padding: '10px' }}>
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Previsualización no disponible para este formato.</p>
                              <a href={file.dataUrl} download={file.name} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>Descargar Archivo</a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showUploadModal && (
        <Modal onClose={() => setShowUploadModal(false)} maxWidth="520px">
          <div className="modal-header">
            <h3>Subir Archivo Utilitario</h3>
            <button className="btn btn-secondary" onClick={() => setShowUploadModal(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="modal-body">
              {uploadError && (
                <div 
                  style={{ 
                    padding: '10px 14px', 
                    backgroundColor: 'rgba(230, 92, 0, 0.1)', 
                    border: '1px solid var(--danger)', 
                    borderRadius: 'var(--radius-sm)', 
                    color: 'var(--danger)',
                    fontSize: '0.75rem',
                    fontWeight: 500
                  }}
                >
                  ⚠️ {uploadError}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Seleccionar Archivo (Máx. 10 MB)</label>
                <input 
                  type="file" 
                  className="form-input" 
                  onChange={handleFileChange}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Nombre del Archivo</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="ej. sql-server-express-installer.exe"
                  value={fileName}
                  onChange={e => setFileName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Descripción / Utilidad</label>
                <textarea 
                  rows="3" 
                  className="form-textarea" 
                  placeholder="Explique brevemente para qué sirve este utilitario o cómo usarlo en el cliente..."
                  value={fileDesc}
                  onChange={e => setFileDesc(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Categoría sugerida</label>
                  <select 
                    className="form-select"
                    value={fileCategory}
                    onChange={e => setFileCategory(e.target.value)}
                  >
                    {categories.filter(c => c !== 'Todos').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Tamaño detectado</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={fileSize}
                    readOnly
                    placeholder="0.00 KB"
                    style={{ backgroundColor: 'var(--card-hover)', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowUploadModal(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={!!uploadError || !fileDataUrl}>Guardar en Servidor</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
