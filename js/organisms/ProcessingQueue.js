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
import { extractBarcodeFromPDF } from '../services/pdf-extractor.js';
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
 * @typedef {Object} ProcessError
 * @property {string} fileName - The file that caused the error.
 * @property {string} error    - Human-readable error description.
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
 * Processes a single file through the pipeline.
 *
 * @param {File}   file          - The PDF file.
 * @param {string} fechaEmision  - Fecha Pago in AAMMDD format.
 * @param {string} expectedEnte  - Expected entity code for barcode validation.
 * @param {'1'|'2'|'auto'} [vencimiento='auto'] - Which vencimiento was selected.
 * @param {Function} onProgress  - Called with status updates.
 * @returns {Promise<ParsedRecord|ProcessError>}
 */
async function processFile(file, fechaEmision, expectedEnte, vencimiento, onProgress) {
  const fileName = file.name;

  try {
    // Step 1: Extract barcode from file (PDF → pdf.js, TXT → read text).
    onProgress(fileName, 'processing', null);

    let barcode = null;
    const isTxt = fileName.toLowerCase().endsWith('.txt');

    if (isTxt) {
      const text = await file.text();
      const match = text.match(/\b\d{50}\b/);
      barcode = match ? match[0] : null;
    } else {
      barcode = await extractBarcodeFromPDF(file);
    }

    if (!barcode) {
      return {
        fileName,
        error: 'No se encontró código de barra de 50 dígitos en el archivo.',
        step: 'extraction',
      };
    }

    // Step 2: Check digit validation.
    const checkResult = validateCheckDigit(barcode);
    if (!checkResult.isValid) {
      return {
        fileName,
        error: `Dígito verificador inválido (calculado: ${checkResult.calc}, esperado: ${checkResult.expected}).`,
        step: 'validation',
      };
    }

    // Step 3: Parse barcode with entity validation.
    const fields = parseBarcode(barcode, { expectedEnte });

    // Step 3b: Date validation — payment date must never exceed the relevant due date.
    const pagoNum = toComparableDate(fechaEmision, 'aammdd');
    const vto1Num = toComparableDate(fields.fecha1, 'ddmmaa');
    const vto2Num = toComparableDate(fields.fecha2, 'ddmmaa');

    if (vencimiento === '1' || (vencimiento === 'auto' && pagoNum <= vto1Num)) {
      // Paying against 1st due date.
      if (pagoNum > vto1Num) {
        return {
          fileName,
          error: `La fecha de pago (${fechaEmision}) supera el 1er vencimiento (${fields.fecha1}).`,
          step: 'validation',
        };
      }
    } else {
      // Paying against 2nd due date (vencimiento='2' or auto with overdue payment).
      if (pagoNum > vto2Num) {
        return {
          fileName,
          error: `La fecha de pago (${fechaEmision}) supera el 2do vencimiento (${fields.fecha2}).`,
          step: 'validation',
        };
      }
    }

    // Step 4: Build record (pass original barcode to avoid field reconstruction errors).
    const record = buildRecord(fields, fechaEmision, barcode, vencimiento);

    onProgress(fileName, 'done', barcode);

    return {
      fileName,
      barcode,
      fields,
      record,
      recordLength: record.length,
    };
  } catch (/** @type {*} */ err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress(fileName, 'error', null);

    return {
      fileName,
      error: message,
      step: 'parsing',
    };
  }
}

/**
 * Renders a sequential batch processor for PDF files.
 *
 * Processes files one at a time, showing real-time per-file status
 * with badges. Emits {@code onComplete} when all files are done.
 *
 * @param {Object} props               - Component properties.
 * @param {File[]} props.files         - Array of PDF files to process.
 * @param {string} props.fechaEmision  - Fecha Pago in YYYY-MM-DD format.
 *        Internally converted to AAMMDD for the record builder.
 * @param {string} [props.expectedEnte='0135']
 *        Expected entity code for barcode validation. Set this to filter
 *        barcodes from a specific municipality or entity (e.g. `'0135'`
 *        for Hurlingham). Pass an empty string to skip entity validation.
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

  // --- Process all files sequentially ---
  (async () => {
    /** @type {ParsedRecord[]} */
    const valid = [];
    /** @type {ProcessError[]} */
    const errors = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result = await processFile(file, fechaAAMMDD, expectedEnte, vencimiento, updateLog);

      if ('step' in result && 'error' in result) {
        errors.push(/** @type {ProcessError} */ (result));
      } else {
        valid.push(/** @type {ParsedRecord} */ (result));
      }

      updateProgress(i + 1);
    }

    onComplete({ valid, errors });
  })();

  return container;
}
