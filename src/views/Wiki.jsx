import React, { useContext, useState } from 'react';
import { AppContext } from '../context/AppContext';
import Modal from '../components/Modal';

export default function Wiki() {
  const { db, addWikiArticle, updateWikiArticle, deleteWikiArticle, currentUser } = useContext(AppContext);
  const [selectedArt, setSelectedArt] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [searchErrorCode, setSearchErrorCode] = useState('');
  const [localErrorCode, setLocalErrorCode] = useState('');
  const [showAddArticle, setShowAddArticle] = useState(false);

  // Edit state
  const [showEditArticle, setShowEditArticle] = useState(false);
  const [editArtId, setEditArtId] = useState('');
  const [editArtTitle, setEditArtTitle] = useState('');
  const [editArtCategory, setEditArtCategory] = useState('Infraestructura');
  const [editArtTags, setEditArtTags] = useState('');
  const [editArtErrorCode, setEditArtErrorCode] = useState('');
  const [editArtContent, setEditArtContent] = useState('');

  const isMaster = currentUser?.role === 'Administrador' || currentUser?.id === 'emp-master';

  // Form state
  const [artTitle, setArtTitle] = useState('');
  const [artCategory, setArtCategory] = useState('Infraestructura');
  const [artTags, setArtTags] = useState('');
  const [artErrorCode, setArtErrorCode] = useState('');
  const [artContent, setArtContent] = useState('');

  if (!db) return null;

  const activeArt = selectedArt || db.knowledgeBase[0];

  const categories = ['Todos', ...new Set([
    ...db.knowledgeBase.map(a => a.category).filter(Boolean),
    'Infraestructura',
    'Bases de Datos',
    'Desarrollo',
    'Redes',
    'Procedimientos Administrativos'
  ])];

  const [selectedCategory, setSelectedCategory] = useState('Todos');

  // Search filter
  const filteredArticles = db.knowledgeBase.filter(art => {
    const query = searchQuery.toLowerCase();
    const errQuery = searchErrorCode.toLowerCase();

    const matchesCategory = selectedCategory === 'Todos' || art.category === selectedCategory;
    const matchesErrorCode = !errQuery || (art.errorCode && art.errorCode.toLowerCase().includes(errQuery));

    const matchesSearch = !query || (
      art.title.toLowerCase().includes(query) ||
      art.category.toLowerCase().includes(query) ||
      (art.tags && Array.isArray(art.tags) && art.tags.some(tag => tag.toLowerCase().includes(query))) ||
      art.content.toLowerCase().includes(query)
    );

    return matchesCategory && matchesErrorCode && matchesSearch;
  });

  // Submit article
  const handleAddArticleSubmit = (e) => {
    e.preventDefault();
    if (!artTitle || !artContent) return;

    const tagsArray = artTags
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0);

    addWikiArticle({
      title: artTitle,
      category: artCategory,
      tags: tagsArray,
      errorCode: artErrorCode,
      content: artContent
    });

    setArtTitle('');
    setArtTags('');
    setArtErrorCode('');
    setArtContent('');
    setShowAddArticle(false);
  };

  const handleOpenEditArticle = (art) => {
    setEditArtId(art.id);
    setEditArtTitle(art.title);
    setEditArtCategory(art.category || 'Infraestructura');
    setEditArtTags(art.tags && Array.isArray(art.tags) ? art.tags.join(', ') : '');
    setEditArtErrorCode(art.errorCode || '');
    setEditArtContent(art.content || '');
    setShowEditArticle(true);
  };

  const handleEditArticleSubmit = (e) => {
    e.preventDefault();
    if (!editArtId || !editArtTitle || !editArtContent) return;

    updateWikiArticle(editArtId, {
      title: editArtTitle,
      category: editArtCategory,
      tags: editArtTags,
      errorCode: editArtErrorCode,
      content: editArtContent
    });

    setShowEditArticle(false);
    // If the currently selected article was edited, update our selectedArt state
    if (selectedArt && selectedArt.id === editArtId) {
      setSelectedArt({
        ...selectedArt,
        title: editArtTitle,
        category: editArtCategory,
        tags: typeof editArtTags === 'string'
          ? editArtTags.split(',').map(t => t.trim()).filter(t => t.length > 0)
          : (Array.isArray(editArtTags) ? editArtTags : []),
        errorCode: editArtErrorCode,
        content: editArtContent,
        lastUpdated: new Date().toISOString().split('T')[0]
      });
    }
  };

  const handleDeleteArticleClick = (artId, artTitle) => {
    if (!window.confirm(`¿Está seguro que desea eliminar el artículo de la Wiki "${artTitle}"?`)) return;
    deleteWikiArticle(artId);
    setSelectedArt(null);
  };

  // Simple Markdown-like Renderer helper
  const renderContent = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} style={{ fontSize: '1.05rem', fontWeight: 500, margin: '20px 0 10px 0', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('## ')) {
        return <h3 key={idx} style={{ fontSize: '1.2rem', fontWeight: 500, margin: '24px 0 12px 0' }}>{line.replace('## ', '')}</h3>;
      }
      if (line.startsWith('* ')) {
        return <li key={idx} style={{ marginLeft: '20px', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{line.replace('* ', '')}</li>;
      }
      if (line.startsWith('`') && line.endsWith('`')) {
        return <code key={idx} style={{ fontFamily: 'monospace', padding: '2px 6px', backgroundColor: 'var(--background)', borderRadius: 'var(--radius-xs)', fontSize: '0.8rem', color: 'var(--primary)' }}>{line.replaceAll('`', '')}</code>;
      }
      if (line.startsWith('   * ')) {
        return <li key={idx} style={{ marginLeft: '40px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{line.replace('   * ', '')}</li>;
      }
      // Code blocks formatting
      if (line.startsWith('     ```') || line.startsWith('     ```bash')) {
        return null; // Ignore opening tags
      }
      return <p key={idx} style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '8px', lineHeight: '1.6' }}>{line}</p>;
    });
  };

  return (
    <div className="page-container" style={{ padding: '0 24px 24px 24px' }}>
      <div className="wiki-grid">
        
        {/* Left Side: Wiki search list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => setShowAddArticle(true)} style={{ width: '100%' }}>
              + Redactar Artículo de Wiki
            </button>
            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                type="text"
                placeholder="Buscar por palabras clave... (Enter)"
                className="form-input"
                value={localSearch}
                onChange={(e) => {
                  setLocalSearch(e.target.value);
                  if (e.target.value === '') {
                    setSearchQuery('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchQuery(localSearch);
                  }
                }}
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px', minWidth: 'auto' }}
                onClick={() => setSearchQuery(localSearch)}
              >
                🔍
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
              <input
                type="text"
                placeholder="🔍 Buscar Código de Error... (Enter)"
                className="form-input"
                value={localErrorCode}
                onChange={(e) => {
                  setLocalErrorCode(e.target.value);
                  if (e.target.value === '') {
                    setSearchErrorCode('');
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setSearchErrorCode(localErrorCode);
                  }
                }}
                style={{ flex: 1 }}
              />
              <button 
                className="btn btn-secondary" 
                style={{ padding: '8px 12px', minWidth: 'auto' }}
                onClick={() => setSearchErrorCode(localErrorCode)}
              >
                🔍
              </button>
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '4px' }}>Filtrar por Categoría / Caso</label>
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '55vh', overflowY: 'auto' }}>
            {filteredArticles.map(art => (
              <div
                key={art.id}
                onClick={() => setSelectedArt(art)}
                style={{
                  padding: '12px 16px',
                  backgroundColor: activeArt.id === art.id ? 'var(--primary-glow)' : 'var(--card)',
                  border: `1px solid ${activeArt.id === art.id ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
              >
                <div style={{ fontWeight: 500, fontSize: '0.8125rem' }}>{art.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  <span>{art.category}</span>
                  <span>✍ {art.author}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Active Article details */}
        {activeArt ? (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '30px' }}>
            <div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-primary">{activeArt.category}</span>
                {activeArt.errorCode && (
                  <span className="badge badge-danger" style={{ fontSize: '0.65rem', backgroundColor: 'rgba(230, 92, 0, 0.1)', color: 'var(--warning)', borderColor: 'var(--warning)', borderWidth: '1px', borderStyle: 'solid' }}>
                     Error: {activeArt.errorCode}
                  </span>
                )}
                {activeArt.tags && Array.isArray(activeArt.tags) && activeArt.tags.map((tag, i) => (
                  <span key={i} className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>#{tag}</span>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 600, letterSpacing: '-0.03em', margin: 0 }}>{activeArt.title}</h1>
                {isMaster && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => handleOpenEditArticle(activeArt)}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                       Editar
                    </button>
                    <button 
                      className="btn" 
                      onClick={() => handleDeleteArticleClick(activeArt.id, activeArt.title)}
                      style={{ padding: '6px 12px', fontSize: '0.75rem', backgroundColor: 'rgba(230, 92, 0, 0.1)', color: 'var(--danger)', border: '1px solid rgba(230, 92, 0, 0.3)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                       Eliminar
                    </button>
                  </div>
                )}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Última actualización: <strong>{activeArt.lastUpdated}</strong> | Autor: <strong>{activeArt.author}</strong>
              </p>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
              {activeArt.content.includes('```') ? (
                <div style={{ fontSize: '0.875rem' }}>
                  {activeArt.content.split('\n').map((line, idx) => {
                    if (line.includes('```')) return null;
                    return <div key={idx} style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>{line}</div>;
                  })}
                </div>
              ) : (
                renderContent(activeArt.content)
              )}
            </div>
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No hay artículos cargados en la Wiki.
          </div>
        )}
      </div>

      {showAddArticle && (
        <Modal onClose={() => setShowAddArticle(false)} maxWidth="600px">
            <div className="modal-header">
              <h3>Redactar Artículo de Wiki</h3>
              <button className="btn btn-secondary" onClick={() => setShowAddArticle(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleAddArticleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título del Artículo</label>
                  <input type="text" placeholder="ej. Cómo renovar certificados SSL Let's Encrypt" className="form-input" required value={artTitle} onChange={e => setArtTitle(e.target.value)} />
                </div>
                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select className="form-select" value={artCategory} onChange={e => setArtCategory(e.target.value)}>
                      <option value="Infraestructura">Infraestructura</option>
                      <option value="Bases de Datos">Bases de Datos</option>
                      <option value="Desarrollo">Desarrollo</option>
                      <option value="Redes">Redes</option>
                      <option value="Procedimientos Administrativos">Procedimientos Administrativos</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Etiquetas (Separadas por coma)</label>
                    <input type="text" placeholder="ej. SSL, Linux, Nginx" className="form-input" value={artTags} onChange={e => setArtTags(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Código de Error (Opcional)</label>
                  <input type="text" placeholder="ej. ERR-1002, a2-301" className="form-input" value={artErrorCode} onChange={e => setArtErrorCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contenido Técnico (Soporta Markdown simple)</label>
                  <textarea rows="10" placeholder="Escriba los pasos detallados, comandos de terminal y advertencias..." className="form-textarea" required value={artContent} onChange={e => setArtContent(e.target.value)} style={{ fontFamily: 'monospace' }}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddArticle(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Publicar Artículo</button>
              </div>
            </form>
        </Modal>
      )}
      {showEditArticle && (
        <Modal onClose={() => setShowEditArticle(false)} maxWidth="600px">
            <div className="modal-header">
              <h3>Editar Artículo de Wiki</h3>
              <button className="btn btn-secondary" onClick={() => setShowEditArticle(false)} style={{ padding: '6px 12px', minWidth: 'auto' }}>✕</button>
            </div>
            <form onSubmit={handleEditArticleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Título del Artículo</label>
                  <input type="text" placeholder="ej. Cómo renovar certificados SSL Let's Encrypt" className="form-input" required value={editArtTitle} onChange={e => setEditArtTitle(e.target.value)} />
                </div>
                <div className="grid-cols-2" style={{ gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Categoría</label>
                    <select className="form-select" value={editArtCategory} onChange={e => setEditArtCategory(e.target.value)}>
                      <option value="Infraestructura">Infraestructura</option>
                      <option value="Bases de Datos">Bases de Datos</option>
                      <option value="Desarrollo">Desarrollo</option>
                      <option value="Redes">Redes</option>
                      <option value="Procedimientos Administrativos">Procedimientos Administrativos</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Etiquetas (Separadas por coma)</label>
                    <input type="text" placeholder="ej. SSL, Linux, Nginx" className="form-input" value={editArtTags} onChange={e => setEditArtTags(e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Código de Error (Opcional)</label>
                  <input type="text" placeholder="ej. ERR-1002, a2-301" className="form-input" value={editArtErrorCode} onChange={e => setEditArtErrorCode(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Contenido Técnico (Soporta Markdown simple)</label>
                  <textarea rows="10" placeholder="Escriba los pasos detallados, comandos de terminal y advertencias..." className="form-textarea" required value={editArtContent} onChange={e => setEditArtContent(e.target.value)} style={{ fontFamily: 'monospace' }}></textarea>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowEditArticle(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
        </Modal>
      )}
    </div>
  );
}
