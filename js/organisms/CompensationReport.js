/**
 * CompensationReport organism component.
 *
 * Displays a summary of the completed batch processing run, including
 * a header with totals, an error list, and action buttons for
 * downloading, cancelling, or continuing past errors.
 *
 * The download action generates a Blob from valid records and triggers
 * a browser download via a temporary anchor element.
 *
 * @module organisms/CompensationReport
 */

import { Badge } from '../atoms/Badge.js';
import { Button } from '../atoms/Button.js';
import { formatImporte, formatDate } from '../utils/format.js';

/**
 * Formats an integer cent amount as a peso string with commas.
 *
 * @param {number} cents - Amount in integer cents.
 * @returns {string} e.g. `"$50,601.01"`.
 */


/**
 * Triggers a browser file download from a Blob.
 *
 * @param {Blob}  blob       - The file data.
 * @param {string} fileName  - Suggested file name for the download.
 */
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/**
 * Formats an ISO date string for use in filenames (safe chars only).
 *
 * @param {string} isoDate - YYYY-MM-DD date string.
 * @returns {string} e.g. `"20260608"`.
 */
function safeDate(isoDate) {
  return isoDate.replace(/-/g, '');
}

/**
 * Generates the report HTML as a string.
 *
 * @param {Array<import('./ProcessingQueue.js').ParsedRecord>} records
 * @param {Array<import('./ProcessingQueue.js').ProcessError>} errors
 * @param {string} fechaEmision
 * @param {number} totalCents
 * @returns {string} HTML report content.
 */
function generateReportHTML(records, errors, fechaEmision, totalCents) {
  const rows = records.map((r, i) =>
    `<tr>
      <td>${i + 1}</td>
      <td>${r.fields.nroComprobante}</td>
      <td>${r.fields.tipoComprobante}</td>
      <td>${formatImporte(r.fields.importe1)}</td>
      <td>${r.fields.fecha1}</td>
      <td><code>${r.barcode}</code></td>
    </tr>`
  ).join('\n');

  const errRows = errors.map(e =>
    `<li><strong>${e.fileName}</strong> — ${e.step}: ${e.error}</li>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><title>Informe de Compensación</title>
<style>
  body{font-family:'DM Sans',sans-serif;margin:2rem;color:#333}
  h1{color:#00ad9c;border-bottom:2px solid #00ad9c;padding-bottom:.5rem}
  .summary{display:flex;gap:2rem;margin:1rem 0;flex-wrap:wrap}
  .summary span{background:#f5f7fa;padding:.5rem 1rem;border-radius:6px}
  table{width:100%;border-collapse:collapse;margin-top:1rem}
  th,td{text-align:left;padding:.5rem;border-bottom:1px solid #e9ecef}
  th{background:#f5f7fa;font-weight:600}
  code{font-size:.75rem;word-break:break-all}
  .errors{margin-top:1.5rem}
  .errors h2{color:#d63939}
</style></head>
<body>
  <h1>Informe de Compensación</h1>
  <div class="summary">
    <span>📅 Fecha: ${formatDate(fechaEmision)}</span>
    <span>📄 Comprobantes: ${records.length}</span>
    <span>💰 Total: ${formatImporte(totalCents)}</span>
    <span>⚠️ Errores: ${errors.length}</span>
  </div>
  <table>
    <thead><tr><th>#</th><th>Comprobante</th><th>Tipo</th><th>Importe</th><th>Vencimiento</th><th>Código de Barra</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${errors.length > 0 ? `<div class="errors"><h2>Errores</h2><ol>${errRows}</ol></div>` : ''}
  <p style="margin-top:2rem;color:#999;font-size:.8rem;">Generado el ${new Date().toLocaleString('es-AR')}</p>
</body>
</html>`;
}

/**
 * Renders the compensation report with summary and actions.
 *
 * @param {Object} props                               - Component properties.
 * @param {Array<import('./ProcessingQueue.js').ParsedRecord>} props.records
 *        Successfully processed records.
 * @param {Array<import('./ProcessingQueue.js').ProcessError>} props.errors
 *        Files that failed processing.
 * @param {string} props.fechaEmision                  - ISO date string
 *        (YYYY-MM-DD) used as the batch-wide Fecha Pago.
 * @param {Function} props.onDownload
 *        Callback invoked when the user initiates a download. If not
 *        provided, a default Blob download of concatenated records is
 *        triggered.
 * @param {Function} [props.onCancel]
 *        Callback invoked when the user cancels the batch (clear / reset).
 * @param {Function} [props.onContinue]
 *        Callback invoked when the user chooses to continue despite errors.
 * @returns {HTMLElement} The report container element.
 *
 * @example
 *   const report = CompensationReport({
 *     records: validRecords,
 *     errors: errorList,
 *     fechaEmision: '2026-06-08',
 *     onDownload: () => console.log('Downloading...'),
 *     onCancel: () => resetUI(),
 *     onContinue: () => console.log('Continuing without errors...'),
 *   });
 *   container.append(report);
 */
export function CompensationReport({
  records,
  errors,
  files,
  fechaEmision,
  onDownload,
  onCancel,
  onContinue,
}) {
  const container = document.createElement('div');
  container.className = 'comp-report';

  // Compute totals.
  const totalRecords = records.length;
  const totalErrors = errors.length;
  const totalCents = records.reduce((sum, r) => sum + r.fields.importe1, 0);
  const safeDateStr = safeDate(fechaEmision);

  // ================================================================
  // 1. Summary header
  // ================================================================
  const header = document.createElement('div');
  header.className = 'summary-header';

  const dateSpan = document.createElement('span');
  dateSpan.className = 'comp-report__date';
  dateSpan.textContent = `Fecha: ${formatDate(fechaEmision)}`;
  header.append(dateSpan);

  const totalSpan = document.createElement('span');
  totalSpan.className = 'comp-report__total-records';
  totalSpan.textContent = `Total comprobantes: ${totalRecords}`;
  header.append(totalSpan);

  const amountSpan = document.createElement('span');
  amountSpan.className = 'comp-report__total-amount';
  amountSpan.textContent = `Total importe: ${formatImporte(totalCents)}`;
  header.append(amountSpan);

  const errorCountSpan = document.createElement('span');
  errorCountSpan.className = 'comp-report__error-count';
  const errorBadge = Badge({
    text: `Errores: ${totalErrors}`,
    variant: totalErrors > 0 ? 'error' : 'success',
  });
  errorCountSpan.append(errorBadge);
  header.append(errorCountSpan);

  container.append(header);

  // ================================================================
  // 2. Records table (compact summary)
  // ================================================================
  if (totalRecords > 0) {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-wrapper';

    const table = document.createElement('table');
    table.className = 'comp-report__table';

    const thead = document.createElement('thead');
    const thr = document.createElement('tr');
    ['File', 'Comprobante', 'Importe'].forEach((label) => {
      const th = document.createElement('th');
      th.textContent = label;
      thr.append(th);
    });
    thead.append(thr);
    table.append(thead);

    const tbody = document.createElement('tbody');
    for (const rec of records) {
      const tr = document.createElement('tr');
      tr.className = 'comp-report__record-row';

      const td1 = document.createElement('td');
      td1.textContent = rec.fileName;
      tr.append(td1);

      const td2 = document.createElement('td');
      td2.textContent = rec.fields.nroComprobante;
      tr.append(td2);

      const td3 = document.createElement('td');
      td3.className = 'comp-report__importe';
      td3.textContent = formatImporte(rec.fields.importe1);
      tr.append(td3);

      // Hidden full record in data attribute for download.
      tr.setAttribute('data-record', rec.record);

      tbody.append(tr);
    }

    table.append(tbody);
    wrapper.append(table);
    container.append(wrapper);
  }

  // ================================================================
  // 3. Error list (if any)
  // ================================================================
  if (totalErrors > 0) {
    const errorSection = document.createElement('div');
    errorSection.className = 'comp-report__errors';

    const errorTitle = document.createElement('h3');
    errorTitle.textContent = `Errores (${totalErrors})`;
    errorSection.append(errorTitle);

    const errorList = document.createElement('ul');
    errorList.className = 'comp-report__error-list';

    for (const err of errors) {
      const li = document.createElement('li');
      li.className = 'file-item file-item--error';

      const fileNameSpan = document.createElement('span');
      fileNameSpan.className = 'file-item__name';
      fileNameSpan.textContent = err.fileName;

      const errorMsgSpan = document.createElement('span');
      errorMsgSpan.className = 'comp-report__error-msg';
      errorMsgSpan.textContent = `[${err.step}] ${err.error}`;

      li.append(fileNameSpan, errorMsgSpan);
      errorList.append(li);
    }

    errorSection.append(errorList);
    container.append(errorSection);
  }

  // ================================================================
  // 4. Action buttons
  // ================================================================
  const actions = document.createElement('div');
  actions.className = 'comp-report__actions';

  // --- Default download handler: generate ZIP with TXT + report + PDFs ---
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
      return;
    }

    /* global JSZip */
    if (typeof JSZip === 'undefined') {
      console.error('JSZip not loaded — falling back to TXT-only download.');
      const content = records.map((r) => r.record).join('\r\n');
      const blob = new Blob([content], { type: 'application/octet-stream' });
      downloadBlob(blob, `RAFAMR01_${safeDateStr}.txt`);
      return;
    }

    const zip = new JSZip();

    // 1. Add TXT file with RAFAMR01 records.
    const txtContent = records.map((r) => r.record).join('\r\n');
    zip.file(`RAFAMR01_${safeDateStr}.txt`, txtContent);

    // 2. Add HTML report.
    const reportHTML = generateReportHTML(records, errors, fechaEmision, totalCents);
    zip.file(`Informe_${safeDateStr}.html`, reportHTML);

    // 3. Add all source PDFs.
    const pdfFolder = zip.folder(`facturas_${safeDateStr}`);
    if (files && files.length > 0) {
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        pdfFolder.file(file.name, arrayBuffer);
      }
    } else {
      // Fallback: add from records if files not available.
      for (const r of records) {
        pdfFolder.file(`${r.fileName}`, `Original PDF: ${r.fileName}\nBarcode: ${r.barcode}\n`);
      }
    }

    // 4. Generate and download ZIP.
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(zipBlob, `compensacion_${safeDateStr}.zip`);
  };

  const downloadBtn = Button({
    label: 'Descargar TXT',
    icon: 'download',
    variant: 'primary',
    disabled: totalRecords === 0,
    onClick: handleDownload,
  });
  actions.append(downloadBtn);

  // --- Error recovery buttons ---
  if (totalErrors > 0) {
    if (onCancel) {
      const cancelBtn = Button({
        label: 'Cancelar lote',
        variant: 'danger',
        onClick: onCancel,
      });
      actions.append(cancelBtn);
    }

    if (onContinue) {
      const continueBtn = Button({
        label: 'Continuar sin errores',
        variant: 'outline',
        onClick: onContinue,
      });
      actions.append(continueBtn);
    }
  }

  container.append(actions);

  // --- Trigger Lucide icon rendering for action buttons ---
  if (typeof lucide !== 'undefined') {
    try { lucide.createIcons(); } catch (e) { console.warn('Lucide icons failed to render:', e); }
  }

  return container;
}
