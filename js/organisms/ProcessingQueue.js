/**
 * ProcessingQueue organism component.
 *
 * Sequential batch processor that runs each file through the extraction,
 * validation, and record-building pipeline. Processes one file at a time
 * to manage browser memory, emitting real-time per-file status updates.
 *
 * Supports both PDF and TXT files:
 *   - **PDF**: text extracted via pdf.js, barcode found by regex.
 *   - **TXT**: file read as plain text, barcode found by regex.
 *
 * Pipeline (per file):
 *   1. Barcode extraction (pdf.js for PDF, raw text for TXT).
 *   2. Check digit validation (Formato 50).
 *   3. Barcode parsing + date validation.
 *   4. Record building with per-record payment date.
 *
 * When a specific vencimiento is selected ('1' or '2'), each record uses its
 * own due date (fecha1 or fecha2) as the payment date (Fecha Pago), and its
 * corresponding importe. In 'auto' mode the batch payment date is used.
 *   2. `validateCheckDigit(barcode)` — Formato 50 check digit.
 *   3. `parseBarcode(barcode, { expectedEnte })` — field extraction + entity validation.
 *   4. `buildRecord(fields, fechaEmision)` — RAFAMR01 record.
 *
 * The `expectedEnte` option defaults to the value in {@link CONFIG.entity.code}
 * but can be overridden per instance for different entities.
 *
 * @module organisms/ProcessingQueue
 */

import { StatusIndicator } from '../molecules/StatusIndicator.js';
import { Badge } from '../atoms/Badge.js';
import { extractBarcodesFromPDF } from '../services/pdf-extractor.js';
import { importFromExcel } from '../services/excel-handler.js';
import { validateCheckDigit } from '../services/check-digit.js';
import { parseBarcode } from '../services/barcode-parser.js';
import { buildRecord } from '../services/rafam-builder.js';
import { CONFIG } from '../config.js';

/**
 * Converts a DDMMAA or AAMMDD date string to YYYYMMDD for comparison.
 *
 * @param {string} dateStr - 6-character date string.
 * @param {'ddmmaa'|'aammdd'} format - Input format.
 * @returns {number} Date as YYYYMMDD integer (assumes 2000+ century).
 */
function toComparableDate(dateStr, format) {
  let aa, mm, dd;
  if (format === 'aammdd') {
    aa = dateStr.substring(0, 2);
    mm = dateStr.substring(2, 4);
    dd = dateStr.substring(4, 6);
  } else {
    dd = dateStr.substring(0, 2);
    mm = dateStr.substring(2, 4);
    aa = dateStr.substring(4, 6);
  }
  return Number(`20${aa}${mm}${dd}`);
}

/**
 * Converts a DDMMAA date string to AAMMDD format.
 *
 * @param {string} ddmma - 6-character date in DDMMAA format.
 * @returns {string} The date in AAMMDD format.
 */
function toAAMMDD(ddmma) {
  return ddmma.substring(4, 6) + ddmma.substring(2, 4) + ddmma.substring(0, 2);
}

/**
 * @typedef {Object} ProcessError
 * @property {string}   fileName  - The file that caused the error.
 * @property {string}   [barcode] - The barcode that failed (multi-barcode files).
 * @property {string}   error     - Human-readable error description.
 * @property {'extraction'|'validation'|'parsing'} step
 *   The pipeline step that failed.
 */

/**
 * @typedef {Object} ParsedRecord
 * @property {string}          fileName      - Source PDF file name.
 * @property {string}          barcode       - Extracted 50-digit barcode.
 * @property {import('../services/barcode-parser.js').BarcodeFields} fields
 *   Parsed barcode fields.
 * @property {string}          record        - 279-char RAFAMR01 record.
 * @property {number}          recordLength  - Length of the record (always 279).
 */

/**
 * Result emitted when all files have been processed.
 *
 * @typedef {Object} ProcessResult
 * @property {ParsedRecord[]} valid  - Successfully processed records.
 * @property {ProcessError[]} errors - Files that failed processing.
 */

/**
 * Creates a single file-log element for the processing log.
 *
 * @param {string}     fileName - The file name.
 * @param {string}     status   - Current status key.
 * @param {string}     [barcode] - Optional barcode string.
 * @returns {HTMLElement} The log entry element.
 */
function createLogEntry(fileName, status, barcode) {
  const item = document.createElement('div');
  item.className = `file-item file-item--${status}`;

  const nameSpan = document.createElement('span');
  nameSpan.className = 'file-item__name';
  nameSpan.textContent = fileName;

  const badgeSpan = document.createElement('span');
  const badge = Badge({
    text: status === 'processing' ? 'Procesando' :
          status === 'done' ? 'Completado' : 'Error',
    variant: status === 'done' ? 'success' : status === 'error' ? 'error' : 'info',
  });
  badgeSpan.append(badge);

  item.append(nameSpan, badgeSpan);

  if (barcode) {
    const codeSpan = document.createElement('code');
    codeSpan.className = 'file-item__barcode';
    codeSpan.textContent = barcode;
    item.append(codeSpan);
  }

  return item;
}

/**
 * Processes a single file through the pipeline, extracting ALL barcodes.
 *
 * Each unique barcode found in the file goes through validation, parsing,
 * and record building. Duplicate barcodes within the same file are skipped.
 *
 * When a specific vencimiento is selected ('1' or '2'), each record uses its
 * own due date as the payment date (Fecha Pago) and its own importe (Importe Cobrado).
 * In 'auto' mode, the batch-wide payment date is used and the importe is
 * resolved by comparing it against the first due date.
 *
 * @param {File}   file          - The PDF or TXT file.
 * @param {string} fechaEmision  - Batch-wide Fecha Pago in AAMMDD format
 *        (only used in 'auto' mode; overridden per record in '1'/'2' mode).
 * @param {string} expectedEnte  - Expected entity code for barcode validation.
 * @param {'1'|'2'|'auto'} [vencimiento='auto'] - Which vencimiento to apply.
 * @param {Function} onProgress  - Called with status updates.
 * @returns {Promise<{valid: ParsedRecord[], errors: ProcessError[]}>}
 */
async function processFile(file, fechaEmision, expectedEnte, vencimiento, onProgress) {
  const fileName = file.name;

  /** @type {ParsedRecord[]} */
  const valid = [];
  /** @type {ProcessError[]} */
  const errors = [];

  // Step 1: Extract all barcodes from file (PDF → pdf.js, TXT → read text, XLSX → rows).
  onProgress(fileName, 'processing', null);

  /** @type {string[]} */
  let barcodes = [];
  const lowerName = fileName.toLowerCase();
  const isTxt = lowerName.endsWith('.txt');
  const isExcel = lowerName.endsWith('.xlsx');

  if (isExcel) {
    const result = await importFromExcel(file, expectedEnte);
    barcodes = result.valid.map((r) => r.barcode);
    // Convert Excel row errors to ProcessError format.
    for (const err of result.errors) {
      errors.push({
        fileName,
        error: `Fila ${err.row}: ${err.error}`,
        step: 'extraction',
      });
    }
  } else if (isTxt) {
    const text = await file.text();
    const matches = [...text.matchAll(/\b\d{50}\b/g)];
    barcodes = matches.map((m) => m[0]);
  } else {
    barcodes = await extractBarcodesFromPDF(file);
  }

  // Deduplicate within file while preserving order of first appearance.
  barcodes = [...new Set(barcodes)];

  if (barcodes.length === 0 && errors.length === 0) {
    onProgress(fileName, 'error', null);
    errors.push({
      fileName,
      error: 'No se encontraron códigos de barra de 50 dígitos en el archivo.',
      step: 'extraction',
    });
  }

  for (const barcode of barcodes) {
    try {
      // Step 2: Check digit validation.
      const checkResult = validateCheckDigit(barcode);
      if (!checkResult.isValid) {
        errors.push({
          fileName,
          barcode,
          error: `Dígito verificador inválido (calculado: ${checkResult.calc}, esperado: ${checkResult.expected}).`,
          step: 'validation',
        });
        continue;
      }

      // Step 3: Parse barcode with entity validation.
      const fields = parseBarcode(barcode, { expectedEnte });

      // Step 3b: Resolve effective payment date and vencimiento mode per record.
      let effectiveFecha = fechaEmision;
      const effectiveVenc = vencimiento;

      if (vencimiento === '1') {
        effectiveFecha = toAAMMDD(fields.fecha1);
      } else if (vencimiento === '2') {
        effectiveFecha = toAAMMDD(fields.fecha2);
      } else {
        // 'auto': validate payment date doesn't exceed the relevant due date.
        const pagoNum = toComparableDate(fechaEmision, 'aammdd');
        const vto1Num = toComparableDate(fields.fecha1, 'ddmmaa');
        const vto2Num = toComparableDate(fields.fecha2, 'ddmmaa');

        if (pagoNum > vto1Num && pagoNum > vto2Num) {
          errors.push({
            fileName,
            barcode,
            error: `La fecha de pago (${fechaEmision}) supera ambos vencimientos (${fields.fecha1}, ${fields.fecha2}).`,
            step: 'validation',
          });
          continue;
        }
      }

      // Step 4: Build record with per-record payment date and vencimiento mode.
      const record = buildRecord(fields, effectiveFecha, barcode, effectiveVenc);

      valid.push({
        fileName,
        barcode,
        fields,
        record,
        recordLength: record.length,
      });
    } catch (/** @type {*} */ err) {
      errors.push({
        fileName,
        barcode,
        error: err instanceof Error ? err.message : String(err),
        step: 'parsing',
      });
    }
  }

  const status = valid.length > 0 ? 'done' : 'error';
  const label = `${barcodes.length} código${barcodes.length !== 1 ? 's' : ''}`;
  onProgress(fileName, status, label);

  return { valid, errors };
}

/**
 * Renders a sequential batch processor for PDF/TXT files.
 *
 * Processes files one at a time, extracting all barcodes per file.
 * Duplicate barcodes are removed both within each file and across
 * the entire batch (first occurrence wins). Shows real-time per-file
 * status with badges. Emits {@code onComplete} when all files are done.
 *
 * @param {Object} props               - Component properties.
 * @param {File[]} props.files         - Array of PDF/TXT files to process.
 * @param {string} props.fechaEmision  - Fecha Pago in YYYY-MM-DD format.
 *        Internally converted to AAMMDD for the record builder.
 * @param {string} [props.expectedEnte='0135']
 *        Expected entity code for barcode validation. Set this to filter
 *        barcodes from a specific municipality or entity (e.g. `'0135'`
 *        for Hurlingham). Pass an empty string to skip entity validation.
 * @param {'1'|'2'|'auto'} [props.vencimiento='auto']
 *        Which vencimiento mode to apply to all records.
 * @param {Function} props.onComplete
 *        Callback invoked with {@link ProcessResult} when all files
 *        have been processed.
 * @returns {HTMLElement} The processing queue container.
 *
 * @example
 *   const queue = ProcessingQueue({
 *     files: pdfFiles,
 *     fechaEmision: '2026-06-08',
 *     expectedEnte: '0135',
 *     onComplete: ({ valid, errors }) => {
 *       console.log(`${valid.length} valid, ${errors.length} errors`);
 *     },
 *   });
 *   container.append(queue);
 */
export function ProcessingQueue({ files, fechaEmision, expectedEnte = CONFIG.entity.code, vencimiento = 'auto', onComplete }) {
  const container = document.createElement('div');
  container.className = 'comp-processing-queue';

  // Convert ISO date (YYYY-MM-DD) to AAMMDD for RAFAM.
  const [yr, mo, day] = fechaEmision.split('-');
  const fechaAAMMDD = yr.slice(2) + mo + day;

  // --- Status indicator ---
  const statusEl = StatusIndicator({
    current: 0,
    total: files.length,
    status: 'processing',
  });
  container.append(statusEl);

  // --- Processing log ---
  const log = document.createElement('div');
  log.className = 'comp-processing-queue__log';
  log.setAttribute('aria-live', 'polite');
  container.append(log);

  /**
   * Updates the log entry for a file.
   *
   * @param {string} fileName  - The file being updated.
   * @param {string} status    - 'processing', 'done', or 'error'.
   * @param {string|null} barcode - Optional barcode to display.
   */
  function updateLog(fileName, status, barcode) {
    const entry = createLogEntry(fileName, status, barcode);
    log.append(entry);
  }

  /**
   * Updates the progress bar values in-place.
   *
   * @param {number} current - Number of processed files.
   */
  function updateProgress(current) {
    const progress = statusEl.querySelector('progress');
    const label = statusEl.querySelector('.comp-status__label');
    if (progress) {
      progress.value = current;
    }
    if (label) {
      label.textContent = `${current} / ${files.length} processed`;
    }
    // Update status class on the container.
    statusEl.className = 'comp-status';
    statusEl.classList.add(
      current === files.length ? 'comp-status--done' : 'comp-status--processing',
    );
  }

  // --- Process all files sequentially with batch-level dedup ---
  (async () => {
    /** @type {ParsedRecord[]} */
    const valid = [];
    /** @type {ProcessError[]} */
    const errors = [];
    /** @type {Set<string>} */
    const seenBarcodes = new Set();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await processFile(file, fechaAAMMDD, expectedEnte, vencimiento, updateLog);

      // Batch-level dedup: skip records whose barcode was already processed.
      for (const rec of result.valid) {
        if (!seenBarcodes.has(rec.barcode)) {
          seenBarcodes.add(rec.barcode);
          valid.push(rec);
        }
      }

      errors.push(...result.errors);
      updateProgress(i + 1);
    }

    onComplete({ valid, errors });
  })();

  return container;
}
