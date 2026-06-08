/**
 * Excel import handler service.
 *
 * Reads an Excel file (.xlsx) with comprobante rows, constructs valid 50-digit
 * barcodes from the fields (ente from config, check digit calculated), and
 * returns them ready for the processing pipeline.
 *
 * Also provides a template generator for download.
 *
 * Template columns (what the user fills in):
 *   - Nro Comprobante  (11 digits)
 *   - Tipo             (2 digits, default "07")
 *   - Fecha 1er Vto    (6 digits, DDMMAA)
 *   - Importe 1er Vto  (in pesos, e.g. 120553.57)
 *   - Fecha 2do Vto    (6 digits, DDMMAA)
 *   - Importe 2do Vto  (in pesos, e.g. 120553.57)
 *
 * Auto-calculated from config/algorithm:
 *   - Ente code (from theme.js / CONFIG)
 *   - Full 50-digit barcode
 *   - Dígito Verificador (Formato 50 algorithm)
 *
 * @module services/excel-handler
 */



/** @const {string[]} Column headers for the import template. */
export const TEMPLATE_COLUMNS = [
  'Nro Comprobante',
  'Tipo',
  'Fecha 1er Vto',
  'Importe 1er Vto ($)',
  'Fecha 2do Vto',
  'Importe 2do Vto ($)',
];

/**
 * Converts an importe in pesos (e.g. 120553.57) to integer cents.
 *
 * @param {number} pesos - Amount in pesos with up to 2 decimals.
 * @returns {number} Amount in integer cents.
 */
function pesosToCents(pesos) {
  // Redondear a 2 decimales primero para manejar entradas con más decimales
  // (ej. 120553.5789 → 120553.58) y errores de punto flotante.
  return Math.round(pesos * 100 + Number.EPSILON);
}

/**
 * Computes the Formato 50 check digit from a 49-digit prefix.
 *
 * Algorithm (from check-digit.js):
 *   1. From the RIGHTMOST digit, double every second digit.
 *   2. Sum doubled products directly (not digit-wise).
 *   3. Sum non-doubled digits directly.
 *   4. total = sum_doubled + sum_non_doubled.
 *   5. digitSum = sum of decimal digits of total.
 *   6. DV = (10 - (digitSum % 10)) % 10.
 *
 * @param {string} prefix - 49-character numeric string.
 * @returns {number} The computed check digit (0–9).
 */
function computeCheckDigit(prefix) {
  let sumDoubled = 0;
  let sumNonDoubled = 0;

  for (let i = prefix.length - 1; i >= 0; i--) {
    const digit = Number.parseInt(prefix.charAt(i), 10);
    const positionFromRight = prefix.length - i;

    if (positionFromRight % 2 === 1) {
      sumDoubled += digit * 2;
    } else {
      sumNonDoubled += digit;
    }
  }

  const total = sumDoubled + sumNonDoubled;
  const totalStr = String(total);
  let digitSum = 0;
  for (let i = 0; i < totalStr.length; i++) {
    digitSum += Number.parseInt(totalStr.charAt(i), 10);
  }

  return (10 - (digitSum % 10)) % 10;
}

/**
 * Constructs a full 50-digit barcode from component fields.
 *
 * @param {string} ente     - Entity code (4 digits).
 * @param {string} fecha1   - First due date (6 digits, DDMMAA).
 * @param {number} importe1 - First amount in integer cents.
 * @param {string} fecha2   - Second due date (6 digits, DDMMAA).
 * @param {number} importe2 - Second amount in integer cents.
 * @param {string} nro      - Voucher number (11 digits).
 * @param {string} tipo     - Voucher type (2 digits).
 * @returns {string} Full 50-digit barcode.
 */
function buildBarcode(ente, fecha1, importe1, fecha2, importe2, nro, tipo) {
  const prefix =
    String(ente).padStart(4, '0') +
    String(fecha1).padStart(6, '0') +
    String(importe1).padStart(10, '0') +
    String(fecha2).padStart(6, '0') +
    String(importe2).padStart(10, '0') +
    String(nro).padStart(11, '0') +
    String(tipo).padStart(2, '0');

  if (prefix.length !== 49) {
    throw new Error(`Barcode prefix must be 49 digits, got ${prefix.length}. Check field lengths.`);
  }

  const dv = computeCheckDigit(prefix);
  return prefix + dv;
}

/**
 * Parsed row from the Excel import.
 *
 * @typedef {Object} ExcelRow
 * @property {string} nroComprobante  - Voucher number.
 * @property {string} tipoComprobante - Voucher type.
 * @property {string} fecha1          - First due date (DDMMAA).
 * @property {number} importe1Cents   - First amount in cents.
 * @property {string} fecha2          - Second due date (DDMMAA).
 * @property {number} importe2Cents   - Second amount in cents.
 */

/**
 * Result of processing an Excel file.
 *
 * @typedef {Object} ExcelResult
 * @property {Array<{row: number, barcode: string, fields: ExcelRow}>} valid
 * @property {Array<{row: number, error: string}>} errors
 */

/**
 * Reads an Excel file and converts each row into a validated 50-digit barcode.
 *
 * @param {File} file - The .xlsx file.
 * @param {string} expectedEnte - Entity code to embed in barcodes (from config).
 * @returns {Promise<ExcelResult>}
 */
export async function importFromExcel(file, expectedEnte) {
  /* global XLSX */
  if (typeof XLSX === 'undefined') {
    throw new Error('SheetJS (XLSX) no está disponible.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const wb = XLSX.read(arrayBuffer, { type: 'array', codepage: 65001 });
  const ws = wb.Sheets[wb.SheetNames[0]];

  // Convert to array of arrays (skip empty rows).
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

  if (rows.length < 2) {
    return { valid: [], errors: [{ row: 0, error: 'El archivo Excel no tiene datos (solo encabezados o vacío).' }] };
  }

  // Detect header row — find first row with "Nro Comprobante" or similar.
  let dataStartIndex = 0;
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const row = rows[i];
    const joined = row.filter(Boolean).join(' ');
    if (/comprobante|importe|fecha|vto/i.test(joined)) {
      dataStartIndex = i + 1;
      break;
    }
  }

  /** @type {Array<{row: number, barcode: string, fields: ExcelRow}>} */
  const valid = [];
  /** @type {Array<{row: number, error: string}>} */
  const errors = [];

  for (let i = dataStartIndex; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1; // 1-indexed for user messages

    // Skip completely empty rows.
    if (!row || row.every((/** @type {*} */ c) => c === '' || c === undefined || c === null)) {
      continue;
    }

    const nroRaw = String(row[0] || '').trim();
    const tipoRaw = String(row[1] || '07').trim();
    const fecha1Raw = String(row[2] || '').trim();
    const importe1Raw = row[3];
    const fecha2Raw = String(row[4] || '').trim();
    const importe2Raw = row[5];

    // Validate Nro Comprobante.
    if (!nroRaw) {
      errors.push({ row: rowNum, error: 'Nro Comprobante vacío.' });
      continue;
    }

    const nroClean = nroRaw.replace(/\D/g, '');
    if (nroClean.length > 11) {
      errors.push({ row: rowNum, error: `Nro Comprobante demasiado largo: "${nroRaw}" (máx 11 dígitos).` });
      continue;
    }
    const nroComprobante = nroClean.padStart(11, '0');

    // Tipo Comprobante.
    const tipoClean = tipoRaw.replace(/\D/g, '');
    const tipoComprobante = tipoClean.padStart(2, '0').slice(0, 2);

    // Fecha 1er Vto.
    const fecha1Clean = fecha1Raw.replace(/\D/g, '');
    if (fecha1Clean.length !== 6) {
      errors.push({ row: rowNum, error: `Fecha 1er Vto inválida: "${fecha1Raw}". Debe ser DDMMAA (6 dígitos).` });
      continue;
    }
    const fecha1 = fecha1Clean;

    // Importe 1er Vto.
    if (importe1Raw === '' || importe1Raw === undefined || importe1Raw === null) {
      errors.push({ row: rowNum, error: 'Importe 1er Vto vacío.' });
      continue;
    }
    const importe1Num = Number(importe1Raw);
    if (Number.isNaN(importe1Num) || importe1Num < 0) {
      errors.push({ row: rowNum, error: `Importe 1er Vto inválido: "${importe1Raw}".` });
      continue;
    }
    const importe1Cents = pesosToCents(importe1Num);

    // Fecha 2do Vto.
    const fecha2Clean = fecha2Raw.replace(/\D/g, '');
    if (fecha2Clean.length !== 6) {
      errors.push({ row: rowNum, error: `Fecha 2do Vto inválida: "${fecha2Raw}". Debe ser DDMMAA (6 dígitos).` });
      continue;
    }
    const fecha2 = fecha2Clean;

    // Importe 2do Vto.
    if (importe2Raw === '' || importe2Raw === undefined || importe2Raw === null) {
      errors.push({ row: rowNum, error: 'Importe 2do Vto vacío.' });
      continue;
    }
    const importe2Num = Number(importe2Raw);
    if (Number.isNaN(importe2Num) || importe2Num < 0) {
      errors.push({ row: rowNum, error: `Importe 2do Vto inválido: "${importe2Raw}".` });
      continue;
    }
    const importe2Cents = pesosToCents(importe2Num);

    // Build barcode.
    try {
      const barcode = buildBarcode(
        expectedEnte, fecha1, importe1Cents, fecha2, importe2Cents,
        nroComprobante, tipoComprobante,
      );

      valid.push({
        row: rowNum,
        barcode,
        fields: { nroComprobante, tipoComprobante, fecha1, importe1Cents, fecha2, importe2Cents },
      });
    } catch (/** @type {*} */ err) {
      errors.push({ row: rowNum, error: `Error generando código de barra: ${err.message}` });
    }
  }

  return { valid, errors };
}

/**
 * Genera y descarga un archivo Excel plantilla con los encabezados
 * y una fila de ejemplo.
 *
 * @param {string} expectedEnte - Entity code for the example row.
 */
export function downloadTemplate(expectedEnte) {
  /* global XLSX */
  if (typeof XLSX === 'undefined') {
    console.error('SheetJS (XLSX) no está disponible.');
    return;
  }

  // Números como valores planos (sin formato local). Excel lo muestra según
  // la configuración regional del usuario (en Argentina: 120.553,57).
  const exampleImporte = 120553.57;

  const wb = XLSX.utils.book_new();
  const wsData = [
    TEMPLATE_COLUMNS,
    [
      '00000192840',
      '07',
      '040626',
      exampleImporte,
      '040626',
      exampleImporte,
    ],
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths.
  ws['!cols'] = [
    { wch: 22 },  // Nro Comprobante
    { wch: 10 },  // Tipo
    { wch: 18 },  // Fecha 1er Vto
    { wch: 20 },  // Importe 1er Vto ($)
    { wch: 18 },  // Fecha 2do Vto
    { wch: 20 },  // Importe 2do Vto ($)
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Compensaciones');

  // --- Hoja 2: Formato de campos ---
  const fmtData = [
    ['Campo', 'Posición', 'Dígitos', 'Formato', 'Ejemplo', 'Validación', 'Autocalculado'],
    ['Código de ente', '0–3', 4, 'Numérico', expectedEnte, 'Debe coincidir con el municipio configurado', 'Sí — de la configuración'],
    ['Fecha 1er Vto', '4–9', 6, 'DDMMAA', '040626', '6 dígitos numéricos. Dia(2)+Mes(2)+Año(2)', 'No'],
    ['Importe 1er Vto ($)', '10–19', 10, 'Numérico (centavos)', '120553,57', 'En pesos argentinos. Se convierte a centavos automáticamente', 'No — pero se multiplica ×100'],
    ['Fecha 2do Vto', '20–25', 6, 'DDMMAA', '040626', '6 dígitos numéricos. Puede ser igual al 1ro', 'No'],
    ['Importe 2do Vto ($)', '26–35', 10, 'Numérico (centavos)', '120553,57', 'En pesos argentinos. Se convierte a centavos', 'No — pero se multiplica ×100'],
    ['Nro Comprobante', '36–46', 11, 'Numérico', '00000192840', 'Hasta 11 dígitos. Se completa con ceros a la izquierda', 'No'],
    ['Tipo Comprobante', '47–48', 2, 'Numérico', '07', '"07" para consolidación (Tipo 7)', 'No — default "07"'],
    ['', '', '', '', '', '', ''],
    ['Campos calculados automáticamente al importar:', '', '', '', '', '', ''],
    ['Código de barra (50 dígitos)', '0–49', 50, 'Numérico', '(generado)', 'Se arma concatenando todos los campos + dígito verificador', 'Sí'],
    ['Dígito Verificador', '49', 1, 'Numérico', '(calculado)', 'Algoritmo Formato 50 (módulo 10 con pesos alternados)', 'Sí'],
    ['', '', '', '', '', '', ''],
    ['Notas:', '', '', '', '', '', ''],
    ['• Dejá la columna Tipo vacía y se usará "07" por defecto.', '', '', '', '', '', ''],
    ['• Si 1er y 2do vencimiento son iguales, se usa el mismo importe para ambos.', '', '', '', '', '', ''],
    ['• Los importes los ingresás en pesos (ej: 120553,57) y la app los convierte a centavos (12055357).', '', '', '', '', '', ''],
    ['• El orden de las columnas debe respetarse. Los encabezados pueden estar en cualquier fila de las primeras 5.', '', '', '', '', '', ''],
  ];

  const fmtWs = XLSX.utils.aoa_to_sheet(fmtData);
  fmtWs['!cols'] = [
    { wch: 28 },  // Campo
    { wch: 12 },  // Posición
    { wch: 9 },   // Dígitos
    { wch: 22 },  // Formato
    { wch: 18 },  // Ejemplo
    { wch: 48 },  // Validación
    { wch: 26 },  // Autocalculado
  ];

  XLSX.utils.book_append_sheet(wb, fmtWs, '⚠️ Leer — Formato de campos');

  // Trigger download.
  const wbBytes = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbBytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'plantilla_compensacion.xlsx';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
