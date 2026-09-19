import { jsPDF } from 'jspdf';

export function createServiceReportPdf(report, logo) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 20;
  let y = 64;
  const heading = () => {
    doc.addImage(logo, 'PNG', 12, 5, 42, 42);
    doc.setTextColor(22, 39, 57);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(21);
    doc.text('Reporte de servicio', 60, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('JC  |  RIF: J-29391067-6', 60, 32);
    doc.setDrawColor(211, 221, 232);
    doc.line(margin, 47, 190, 47);
    y = 59;
  };
  const lines = (value, size = 11, bold = false) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(String(value || '—').replace(/\r\n/g, '\n'), 170);
    for (const line of wrapped) {
      if (y > 269) { doc.addPage(); heading(); doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); }
      doc.text(line, margin, y);
      y += size * 0.5 + 1;
    }
  };
  heading();
  lines('EMITIDO A', 9, true);
  lines(report.clientName, 15, true);
  y += 6;
  const date = String(report.createdAt || '').replace('T', ' ');
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}:\d{2})/);
  lines(match ? `Fecha: ${match[3]}/${match[2]}/${match[1]}    Hora: ${match[4]}` : `Fecha y hora: ${date}`);
  lines(`Técnico: ${report.createdBy || 'Sin especificar'}`);
  lines(`Supervisado o autorizado por: ${report.authorizedBy?.trim() || 'No registrado'}`);
  lines(`Referencia: ${report.id || 'Sin referencia'}`, 9);
  y += 9;
  lines('TRABAJO REALIZADO', 10, true);
  y += 3;
  lines(report.workDetails);
  const photos = Array.isArray(report.images) ? report.images : [];
  photos.forEach((photo, index) => {
    try {
      if (typeof photo !== 'string' || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(photo)) throw new Error('Formato no admitido');
      const properties = doc.getImageProperties(photo);
      if (!(properties.width > 0 && properties.height > 0)) throw new Error('Imagen no válida');
      doc.addPage();
      heading();
      lines('EVIDENCIAS DEL SERVICIO', 10, true);
      lines(report.clientName, 11);
      lines(`Fotografia ${index + 1} de ${photos.length}`, 9);
      const top = y + 6;
      const maxHeight = 265 - top;
      const scale = Math.min(162 / properties.width, (maxHeight - 8) / properties.height);
      const width = properties.width * scale;
      const height = properties.height * scale;
      doc.setFillColor(247, 249, 252);
      doc.setDrawColor(224, 230, 237);
      doc.roundedRect(margin, top, 170, height + 8, 2, 2, 'FD');
      doc.addImage(photo, properties.fileType, margin + (170 - width) / 2, top + 4, width, height, undefined, 'FAST');
    } catch {
      throw new Error(`No se pudo incluir la fotografía ${index + 1}. Edita el reporte y vuelve a cargar esa imagen.`);
    }
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page);
    doc.setDrawColor(211, 221, 232);
    doc.line(margin, 280, 190, 280);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(91, 107, 122);
    doc.text('JC · Reporte de servicio', margin, 287);
    doc.text(`${page} / ${pages}`, 190, 287, { align: 'right' });
  }
  doc.setProperties({ title: `Reporte de servicio - ${report.clientName}`, author: 'JC', subject: 'Reporte de servicio' });
  return doc;
}
