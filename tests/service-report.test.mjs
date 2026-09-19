import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServiceReportPdf } from '../src/utils/serviceReportPdf.js';

const logo = new Uint8Array(fs.readFileSync(new URL('../src/assets/logo.png', import.meta.url)));
const report = { id: 'sr-test', clientName: 'Cliente de prueba', createdBy: 'Tecnico de prueba', createdAt: '2026-09-19 14:35', workDetails: 'Instalacion y verificacion del respaldo.' };
test('PDF contains recipient, issuer, service date, technician and work, with embedded logo', () => {
  const pdf = createServiceReportPdf(report, logo);
  const output = pdf.output();
  for (const value of ['Reporte de servicio', 'J-29391067-6', 'Cliente de prueba', '19/09/2026', '14:35', 'Tecnico de prueba', 'Instalacion y verificacion del respaldo.']) assert.ok(output.includes(value), value);
  assert.ok(output.includes('/Subtype /Image'));
});
test('long service reports continue onto multiple pages without losing the ending', () => {
  const pdf = createServiceReportPdf({ ...report, workDetails: 'Linea de trabajo realizada.\n'.repeat(180) + 'FINAL DEL REPORTE' }, logo);
  assert.ok(pdf.getNumberOfPages() > 2);
  assert.ok(pdf.output().includes('FINAL DEL REPORTE'));
});
test('PDF includes the person who supervised or authorized the work', () => {
  const pdf = createServiceReportPdf({ ...report, authorizedBy: 'Maria Perez - Encargada' }, logo);
  assert.ok(pdf.output().includes('Maria Perez - Encargada'));
});
test('every attached photo receives its own evidence page; reports without photos have no appendix', () => {
  const photo = `data:image/png;base64,${Buffer.from(logo).toString('base64')}`;
  const pdf = createServiceReportPdf({ ...report, images: [photo, photo] }, logo);
  assert.equal(pdf.getNumberOfPages(), 3);
  assert.ok(pdf.output().includes('Fotografia 1 de 2'));
  assert.ok(pdf.output().includes('Fotografia 2 de 2'));
  const plain = createServiceReportPdf(report, logo);
  assert.equal(plain.getNumberOfPages(), 1);
  assert.ok(!plain.output().includes('EVIDENCIAS'));
});
test('an unreadable photo reports an error instead of silently omitting evidence', () => {
  assert.throws(() => createServiceReportPdf({ ...report, images: ['data:image/png;base64,invalid'] }, logo), /fotografía 1/i);
});
