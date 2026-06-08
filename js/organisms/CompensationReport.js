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
 * Generates an Excel workbook with the compensation report as a downloadable
 * ArrayBuffer. Returns null if SheetJS (XLSX) is not available.
 *
 * @param {Array<import('./ProcessingQueue.js').ParsedRecord>} records
 * @param {Array<import('./ProcessingQueue.js').ProcessError>} errors
 * @param {string} fechaEmision ISO date (YYYY-MM-DD)
 * @returns {Uint8Array|null} XLSX bytes, or null if XLSX is unavailable.
 */
function generateExcelBytes(records, errors, fechaEmision) {
  /* global XLSX */
  if (typeof XLSX === 'undefined') {
    console.warn('SheetJS not loaded — skipping Excel report.');
    return null;
  }

  const wb = XLSX.utils.book_new();

  // --- Hoja 1: Detalle ---
  const detailRows = [
    ['#', 'Comprobante', 'Tipo', 'Importe 1', 'Importe 2', 'Importe cobrado', 'Vto. 1', 'Vto. 2', 'Fecha pago', 'Código de Barra', 'Archivo'],
  ];
  records.forEach((r, i) => {
    // Parse actual importe from the Importe Cobrado field in the record (positions 77-88, 11 chars, cents).
    const importePagado = Number.parseInt(r.record.substring(77, 88), 10) / 100;
    detailRows.push([
      i + 1,
      r.fields.nroComprobante,
      r.fields.tipoComprobante,
      r.fields.importe1 / 100,
      r.fields.importe2 / 100,
      importePagado,
      r.fields.fecha1,
      r.fields.fecha2,
      r.effectiveFecha,
      r.barcode,
      r.fileName,
    ]);
  });

  const detalle = XLSX.utils.aoa_to_sheet(detailRows);

  // Format "Fecha pago" column (col I, index 8) as proper date type.
  for (let i = 0; i < records.length; i++) {
    const cellRef = XLSX.utils.encode_cell({ r: i + 1, c: 8 });
    const cell = detalle[cellRef];
    if (cell && records[i].effectiveFecha) {
      const ef = records[i].effectiveFecha;
      const year = 2000 + Number.parseInt(ef.substring(0, 2), 10);
      const month = Number.parseInt(ef.substring(2, 4), 10) - 1;
      const day = Number.parseInt(ef.substring(4, 6), 10);
      cell.t = 'n';
      cell.z = 'dd/mm/yyyy';
      // Excel serial date: days since Dec 30, 1899 (UTC).
      const excelEpoch = Date.UTC(1899, 11, 30);
      const cellDate = Date.UTC(year, month, day);
      cell.v = (cellDate - excelEpoch) / (24 * 60 * 60 * 1000);
    }
  }

  // Column widths
  detalle['!cols'] = [
    { wch: 5 },   // #
    { wch: 14 },  // Comprobante
    { wch: 6 },   // Tipo
    { wch: 14 },  // Importe 1
    { wch: 14 },  // Importe 2
    { wch: 14 },  // Importe cobrado
    { wch: 10 },  // Vto. 1
    { wch: 10 },  // Vto. 2
    { wch: 12 },  // Fecha pago
    { wch: 54 },  // Código de Barra
    { wch: 24 },  // Archivo
  ];

  XLSX.utils.book_append_sheet(wb, detalle, 'Detalle');

  // --- Hoja 2: Resumen ---
  const totalCents = records.reduce((sum, r) => sum + r.resolvedImporte, 0);
  const summaryRows = [
    ['Concepto', 'Valor'],
    ['Fecha', fechaEmision],
    ['Total comprobantes', records.length],
    ['Total importe', totalCents / 100],
    ['Errores', errors.length],
  ];

  if (errors.length > 0) {
    summaryRows.push([]);
    summaryRows.push(['Archivo', 'Error']);
    errors.forEach((e) => {
      const errMsg = e.barcode ? `[${e.step}] ${e.error} (código: ${e.barcode})` : `[${e.step}] ${e.error}`;
      summaryRows.push([e.fileName, errMsg]);
    });
  }

  const resumen = XLSX.utils.aoa_to_sheet(summaryRows);
  resumen['!cols'] = [{ wch: 24 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, resumen, 'Resumen');

  // Generate binary output
  return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
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
  const totalCents = records.reduce((sum, r) => sum + r.resolvedImporte, 0);
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
      td3.textContent = formatImporte(rec.resolvedImporte);
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
      errorMsgSpan.textContent = err.barcode
        ? `[${err.step}] ${err.error} — código: ${err.barcode}`
        : `[${err.step}] ${err.error}`;

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

    // 2. Add Excel report.
    const xlsxBytes = generateExcelBytes(records, errors, fechaEmision);
    if (xlsxBytes) {
      zip.file(`Informe_${safeDateStr}.xlsx`, xlsxBytes);
    }

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
