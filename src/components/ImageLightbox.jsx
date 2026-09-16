import React, { useState, useEffect } from 'react';

export default function ImageLightbox({ images = [], initialIndex = 0, src, onClose }) {
  // Support both single src or array of images
  const imageList = Array.isArray(images) && images.length > 0 
    ? images 
    : (src ? [src] : []);

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [isZoomed, setIsZoomed] = useState(false);

  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Keyboard navigation & Esc key handler
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && imageList.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % imageList.length);
        setIsZoomed(false);
      } else if (e.key === 'ArrowLeft' && imageList.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
        setIsZoomed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [imageList, onClose]);

  if (imageList.length === 0) return null;

  const currentImage = imageList[currentIndex] || imageList[0];

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = currentImage;
    link.download = `imagen_jc_portal_${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrev = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev - 1 + imageList.length) % imageList.length);
    setIsZoomed(false);
  };

  const handleNext = (e) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev + 1) % imageList.length);
    setIsZoomed(false);
  };

  return (
    <div 
      className="image-lightbox-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 22, 35, 0.92)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      {/* Top Toolbar */}
      <div 
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '16px',
          left: '24px',
          right: '24px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          color: '#ffffff',
          zIndex: 100000
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e0e0e0' }}>
            {imageList.length > 1 ? `Foto ${currentIndex + 1} de ${imageList.length}` : 'Vista de Imagen'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn"
            onClick={() => setIsZoomed(!isZoomed)}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {isZoomed ? '🔍 Restablecer' : '🔍 Ampliar Zoom'}
          </button>

          <button
            type="button"
            className="btn"
            onClick={handleDownload}
            style={{
              backgroundColor: 'var(--primary, #0f62fe)',
              color: '#fff',
              border: 'none',
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            💾 Descargar
          </button>

          <button
            type="button"
            className="btn"
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              color: '#fff',
              border: 'none',
              padding: '6px 16px',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="Cerrar (Esc)"
          >
            ✕ Cerrar
          </button>
        </div>
      </div>

      {/* Prev / Next Arrows */}
      {imageList.length > 1 && (
        <>
          <button
            type="button"
            onClick={handlePrev}
            style={{
              position: 'absolute',
              left: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              zIndex: 100000,
              transition: 'all 0.2s'
            }}
            title="Anterior (←)"
          >
            ‹
          </button>

          <button
            type="button"
            onClick={handleNext}
            style={{
              position: 'absolute',
              right: '24px',
              top: '50%',
              transform: 'translateY(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              fontSize: '1.5rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justify: 'center',
              zIndex: 100000,
              transition: 'all 0.2s'
            }}
            title="Siguiente (→)"
          >
            ›
          </button>
        </>
      )}

      {/* Main Image Container */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '82vh',
          display: 'flex',
          alignItems: 'center',
          justify: 'center',
          overflow: isZoomed ? 'auto' : 'hidden',
          borderRadius: '8px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
        }}
      >
        <img
          src={currentImage}
          alt={`Imagen ${currentIndex + 1}`}
          onClick={() => setIsZoomed(!isZoomed)}
          style={{
            maxWidth: isZoomed ? 'none' : '100%',
            maxHeight: isZoomed ? 'none' : '80vh',
            objectFit: 'contain',
            borderRadius: '6px',
            cursor: isZoomed ? 'zoom-out' : 'zoom-in',
            transition: isZoomed ? 'none' : 'transform 0.2s ease-out'
          }}
        />
      </div>
    </div>
  );
}
