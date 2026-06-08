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
 * Parses an importe value from an Excel cell into integer cents.
 *
 * Accepts:
 *   - Number → IEEE 754 (viene así de Excel cuando la celda es numérica).
 *   - String con punto decimal → "120553.57"
 *   - String con coma decimal → "120553,57" (formato argentino).
 *   - String con separador de miles → "120.553,57" o "120,553.57".
 *
 * @param {*} raw - Raw cell value from SheetJS.
 * @returns {number|null} Amount in integer cents, or null if unparseable.
 */
function parseImporte(raw) {
  if (raw === '' || raw === undefined || raw === null) {
    return null;
  }

  // Number → directo a cents (redondeando por floating point).
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.round(raw * 100 + Number.EPSILON);
  }

  // String → limpiar y parsear respetando coma como decimal.
  let str = String(raw).trim();
  if (!str) { return null; }

  // Detectar formato regional:
  //   "120.553,57" → último separador es coma (decimal argentino/europeo)
  //   "120,553.57" → último separador es punto (decimal inglés/US)
  const lastDot = str.lastIndexOf('.');
  const lastComma = str.lastIndexOf(',');

  if (lastComma > lastDot) {
    // Formato argentino/europeo: coma es decimal, punto es separador de miles.
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Formato inglés/US: punto es decimal, coma es separador de miles.
    str = str.replace(/,/g, '');
  }
  // Si no hay separadores, str se mantiene igual.

  const num = Number(str);
  if (Number.isNaN(num) || num < 0) { return null; }

  return Math.round(num * 100 + Number.EPSILON);
}

/**
 * Converts an Excel serial date number to a Date object.
 *
 * Excel serial day 1 = January 1, 1900. Serial 60 = Feb 29, 1900 (Lotus bug,
 * doesn't exist), so for serials >= 61 we subtract 1 day.
 *
 * @param {number} serial - Excel serial date number.
 * @returns {Date}
 */
function excelSerialToDate(serial) {
  const adjusted = serial > 60 ? serial - 1 : serial;
  return new Date((adjusted - 1) * 86400000 + Date.UTC(1899, 11, 30));
}

/**
 * Formats a Date as DDMMAA string.
 *
 * @param {Date} date
 * @returns {string} e.g. "040626".
 */
function dateToDDMMAA(date) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(-2);
  return dd + mm + yy;
}

/**
 * Parses a date value from an Excel cell into DDMMAA format.
 *
 * Accepts:
 *   - Date object → from SheetJS con cellDates:true
 *   - Number → Excel serial date
 *   - String "DDMMAA" (6 dígitos)
 *   - String "DD/MM/AA", "DD-MM-AA", "DD/MM/AAAA", "DD-MM-AAAA"
 *   - String "YYYY-MM-DD", "YYYY/MM/DD"
 *
 * @param {*} raw - Raw cell value from SheetJS.
 * @returns {string|null} 6-digit DDMMAA string, or null if unparseable.
 */
function parseDate(raw) {
  if (raw === '' || raw === undefined || raw === null) {
    return null;
  }

  // Case 1: Date object (SheetJS con cellDates:true).
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return dateToDDMMAA(raw);
  }

  // Case 2: number → Excel serial date (raw cellDates:false).
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = excelSerialToDate(raw);
    if (d.getTime() >= 0) {
      return dateToDDMMAA(d);
    }
    return null;
  }

  const str = String(raw).trim();
  if (!str) { return null; }

  // Case 3: exactly 6 digits → already DDMMAA.
  if (/^\d{6}$/.test(str)) {
    return str;
  }

  // Case 4: try to parse as a date string with separators.
  // DD/MM/AA, DD-MM-AA, DD/MM/AAAA, DD-MM-AAAA, YYYY-MM-DD, etc.
  const parts = str.split(/[/.\-,\s]+/).filter(Boolean);
  if (parts.length !== 3) { return null; }

  let d, m, y;

  // Detect order: if first part has 4 digits → YYYY-MM-DD
  // Otherwise assume DD/MM/YYYY or DD/MM/YY
  if (parts[0].length === 4) {
    y = parts[0];
    m = parts[1];
    d = parts[2];
  } else {
    d = parts[0];
    m = parts[1];
    y = parts[2];
  }

  // Validate numeric.
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m)) { return null; }
  const dd = Number.parseInt(d, 10);
  const mm = Number.parseInt(m, 10);
  if (dd < 1 || dd > 31 || mm < 1 || mm > 12) { return null; }

  let yyyy;
  if (y.length === 4) {
    yyyy = Number.parseInt(y, 10);
  } else if (y.length === 2) {
    yyyy = 2000 + Number.parseInt(y, 10);
  } else {
    return null;
  }

  const ddStr = String(dd).padStart(2, '0');
  const mmStr = String(mm).padStart(2, '0');
  const yyStr = String(yyyy).slice(-2);
  return ddStr + mmStr + yyStr;
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
  const wb = XLSX.read(arrayBuffer, { type: 'array', codepage: 65001, cellDates: true });
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
    const importe1Raw = row[3];
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

    // Fecha 1er Vto (soporta número serial de Excel o texto DDMMAA/DD/MM/AA).
    const fecha1 = parseDate(row[2]);
    if (!fecha1) {
      errors.push({ row: rowNum, error: `Fecha 1er Vto inválida: "${row[2]}". Usá formato fecha de Excel, DDMMAA, DD/MM/AA o DD/MM/AAAA.` });
      continue;
    }

    // Importe 1er Vto (soporta número directo, texto con coma o punto decimal).
    const importe1Cents = parseImporte(importe1Raw);
    if (importe1Cents === null) {
      errors.push({ row: rowNum, error: `Importe 1er Vto inválido: "${importe1Raw}". Ingresá un número positivo (ej: 120553,57).` });
      continue;
    }

    // Fecha 2do Vto — si está vacía, se copia del 1er vencimiento.
    const fecha2 = parseDate(row[4]) || fecha1;

    // Importe 2do Vto — si está vacío se copia del 1er importe.
    const importe2Parsed = parseImporte(importe2Raw);
    if (importe2Parsed === null && importe2Raw !== '' && importe2Raw !== undefined && importe2Raw !== null) {
      errors.push({ row: rowNum, error: `Importe 2do Vto inválido: "${importe2Raw}". Ingresá un número positivo (ej: 120553,57).` });
      continue;
    }
    const importe2Cents = importe2Parsed ?? importe1Cents;

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
  // Fecha ejemplo: 26/06/2004 — SheetJS convierte Date a serial automáticamente
  // y aplica un formato de fecha. En Excel argentino se verá como 26/06/2004.
  const exampleDate = new Date(Date.UTC(2004, 5, 26));

  const wb = XLSX.utils.book_new();
  const wsData = [
    TEMPLATE_COLUMNS,
    [
      '00000192840',
      '07',
      exampleDate,
      exampleImporte,
      exampleDate,
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
    ['• Si la factura tiene un solo vencimiento, dejá las columnas Fecha 2do Vto e Importe 2do Vto vacías — se copian automáticamente del 1ro.', '', '', '', '', '', ''],
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
