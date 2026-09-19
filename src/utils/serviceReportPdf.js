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
  lines(`Referencia: ${report.id || 'Sin referencia'}`, 9);
  y += 9;
  lines('TRABAJO REALIZADO', 10, true);
  y += 3;
  lines(report.workDetails);
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
