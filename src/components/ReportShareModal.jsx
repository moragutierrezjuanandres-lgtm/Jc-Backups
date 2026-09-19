import React, { useEffect, useState } from 'react';
import Modal from './Modal';
import logoUrl from '../assets/logo.png';
import { createServiceReportPdf } from '../utils/serviceReportPdf';

export default function ReportShareModal({ report, onClose }) {
  const [prepared, setPrepared] = useState(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => {
    let alive = true;
    let url;
    (async () => {
      try {
        const response = await fetch(logoUrl);
        if (!response.ok) throw new Error('No se pudo cargar el logo de JC.');
        const pdf = createServiceReportPdf(report, new Uint8Array(await response.arrayBuffer()));
        const filename = `Reporte-JC-${String(report.clientName).replace(/[^\p{L}\p{N}-]/gu, '-').slice(0, 60)}-${report.id}.pdf`;
        const file = new File([pdf.output('arraybuffer')], filename, { type: 'application/pdf' });
        url = URL.createObjectURL(file);
        if (alive) setPrepared({ file, url });
        else URL.revokeObjectURL(url);
      } catch (err) { if (alive) setError(err.message || 'No se pudo preparar el PDF.'); }
    })();
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [report]);
  const canShareFile = prepared && typeof navigator.share === 'function' && navigator.canShare?.({ files: [prepared.file] });
  const share = async () => {
    setError('');
    setSharing(true);
    try { await navigator.share({ files: [prepared.file], title: 'Reporte de servicio JC' }); }
    catch (err) { if (err.name !== 'AbortError') setError('No se pudo compartir. Descarga el PDF y adjúntalo desde WhatsApp.'); }
    finally { setSharing(false); }
  };
  return <Modal onClose={onClose} maxWidth="620px">
    <div className="modal-header"><div><h2>Reporte de servicio</h2><p className="muted">PDF listo para entregar al cliente</p></div></div>
    <div className="report-document-summary">
      <img src={logoUrl} alt="JC" width="72" height="72" />
      <div><strong>{report.clientName}</strong><p>RIF de JC: J-29391067-6</p><p>{report.createdAt} · {report.createdBy}</p></div>
    </div>
    <p className="muted">Supervisado o autorizado por: <strong>{report.authorizedBy || 'No registrado'}</strong></p>
    <p className="report-work-preview">{report.workDetails}</p>
    {report.images?.length > 0 && <div className="report-evidence-preview"><p className="muted">El PDF incluye {report.images.length} fotografía(s) como evidencias.</p><div>{report.images.map((src, index) => <img key={index} src={src} alt={`Evidencia ${index + 1}`} />)}</div></div>}
    {!prepared && !error && <p role="status">Preparando PDF…</p>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {prepared && <>
      <p className="notice">{canShareFile ? 'Pulsa Compartir PDF, elige WhatsApp y selecciona el contacto. El envío lo confirmas tú.' : 'Descarga el PDF y abre WhatsApp. Selecciona el contacto y adjunta el archivo descargado como documento.'}</p>
      <div className="report-share-actions">
        {canShareFile && <button className="btn btn-primary" onClick={share} disabled={sharing}>{sharing ? 'Compartiendo…' : 'Compartir PDF · WhatsApp'}</button>}
        <a className="btn btn-secondary" href={prepared.url} download={prepared.file.name}>Descargar PDF</a>
        <a className="btn btn-secondary" href={prepared.url} target="_blank" rel="noopener noreferrer">Ver PDF</a>
        {!canShareFile && <a className="btn btn-primary" href={`https://wa.me/?text=${encodeURIComponent(`Reporte de servicio JC para ${report.clientName}. Fecha: ${report.createdAt}.`)}`} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a>}
      </div>
    </>}
    <div className="modal-footer"><button className="btn btn-secondary" onClick={onClose}>Cerrar</button></div>
  </Modal>;
}
