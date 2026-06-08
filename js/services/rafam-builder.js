/**
 * RAFAMR01 record builder service.
 *
 * Assembles a 279-character fixed-width record from barcode fields, hardcoded
 * defaults (sourced from the RAFAMR01 spec and SQL template), and a
 * user-supplied Fecha Pago.
 *
 * Record layout (40 fields, 279 chars total, no header/footer):
 *   F01  [001–008] RAFAMR01
 *   F02  [009–012] 0000
 *   F03  [013–013] R
 *   F04  [014–018] 00001
 *   F05  [019–028] 10 spaces
 *   F06  [029–032] 0001
 *   F07  [033–040] 00000000
 *   F08  [041–048] 00000000
 *   F09  [049–050] A3
 *   F10  [051–052] 00
 *   F11  [053–054] 00
 *   F12  [055–058] barcode[0..4]      ← ente
 *   F13  [059–077] 19 zeros
 *   F14  [078–088] importe (see resolveImporte)  ← depends on payment date
 *   F15  [089–099] 11 zeros
 *   F16  [100–110] 11 zeros
 *   F17  [111–111] 0
 *   F18  [112–115] 0000
 *   F19  [116–118] 000
 *   F20  [119–120] 2 spaces
 *   F21  [121–123] 000
 *   F22  [124–129] barcode[4..10]     ← fecha1 (DDMMAA → AAMMDD)
 *   F23  [130–135] barcode[20..26]    ← fecha2 (DDMMAA → AAMMDD)
 *   F24  [136–138] 000
 *   F25  [139–141] 000
 *   F26  [142–145] 0000
 *   F27  [146–153] 00000000
 *   F28  [154–161] 00000000
 *   F29  [162–164] 000
 *   F30  [165–224] barcode[0..49]     ← padEnd(60)
 *   F31  [225–230] fechaEmision       ← user input (AAMMDD)
 *   F32  [231–231] 0
 *   F33  [232–238] 0000000
 *   F34  [239–247] 000000000
 *   F35  [248–249] 00
 *   F36  [250–253] 0000
 *   F37  [254–256] 3 spaces
 *   F38  [257–271] 15 spaces
 *   F39  [272–279] 00000000
 *
 * @module services/rafam-builder
 */

import { CONFIG } from '../config.js';

/**
 * Default configuration for hardcoded RAFAMR01 fields.
 *
 * All values sourced from the CEAMSE.SQL template and the RAFAM v1.3 spec.
 *
 * @typedef {Object} RafamDefaults
 * @property {string} f01  - Record identifier.
 * @property {string} f02  - Captura ID.
 * @property {string} f03  - BCRA bank code indicator.
 * @property {string} f04  - Indicativo.
 * @property {string} f05  - Terminal code (10 spaces).
 * @property {string} f06  - Sucursal code.
 * @property {string} f07  - ON sequence number.
 * @property {string} f08  - Transaction sequence number.
 * @property {string} f09  - Operation code (A3 = Cash/Effective).
 * @property {string} f10  - Desde.
 * @property {string} f11  - Hasta.
 * @property {string} f13  - Relleno 2 (19 zeros).
 * @property {string} f15  - Relleno 3 (11 zeros).
 * @property {string} f16  - Relleno 4 (11 zeros).
 * @property {string} f17  - Currency (0 = Pesos).
 * @property {string} f18  - Cashier code.
 * @property {string} f19  - Relleno 5.
 * @property {string} f20  - Relleno 6 (2 spaces).
 * @property {string} f21  - Security code.
 * @property {string} f24  - Banco del Cheque.
 * @property {string} f25  - Sucursal del Cheque.
 * @property {string} f26  - CP Sucursal del cheque.
 * @property {string} f27  - Cheque number.
 * @property {string} f28  - Cheque account number.
 * @property {string} f29  - Cheque term.
 * @property {string} f32  - Payment mode (0 = Effective).
 * @property {string} f33  - Relleno 7.
 * @property {string} f34  - Relleno 8.
 * @property {string} f35  - Forma de pago.
 * @property {string} f36  - Relleno 9.
 * @property {string} f37  - Relleno 10 (3 spaces).
 * @property {string} f38  - Autorizacion (15 spaces).
 * @property {string} f39  - NRO ANULACION.
 */

/** @type {RafamDefaults} */
export const DEFAULT_CONFIG = Object.freeze({
  f01: 'RAFAMR01',
  f02: '0000',
  f03: 'R',
  f04: '00001',
  f05: '          ', // 10 spaces
  f06: '0001',
  f07: '00000000',
  f08: '00000000',
  f09: 'A3',
  f10: '00',
  f11: '00',
  f13: '0000000000000000000', // 19 zeros
  f15: '00000000000', // 11 zeros
  f16: '00000000000', // 11 zeros
  f17: '0',
  f18: '0000',
  f19: '000',
  f20: '  ', // 2 spaces
  f21: '000',
  f24: '000',
  f25: '000',
  f26: '0000',
  f27: '00000000',
  f28: '00000000',
  f29: '000',
  f32: '0',
  f33: '0000000',
  f34: '000000000',
  f35: '00',
  f36: '0000',
  f37: '   ', // 3 spaces
  f38: '               ', // 15 spaces
  f39: '00000000',
});

/**
 * Resolves the effective RAFAM config by merging CONFIG values on top of
 * DEFAULT_CONFIG. CONFIG values take precedence when present.
 *
 * @returns {RafamDefaults} Merged configuration object.
 */
function resolveConfig() {
  return {
    ...DEFAULT_CONFIG,
    f01: CONFIG.rafam.idCaptura || DEFAULT_CONFIG.f01,
    f04: String(CONFIG.rafam.terminalCode || DEFAULT_CONFIG.f04).padStart(5, '0'),
    f06: String(CONFIG.rafam.branchCode || DEFAULT_CONFIG.f06).padStart(4, '0'),
    f09: String(CONFIG.rafam.operationCode || DEFAULT_CONFIG.f09).padEnd(2, ' '),
    f18: String(CONFIG.rafam.codigoBCRA || DEFAULT_CONFIG.f18).padStart(4, '0'),
  };
}

/**
 * Converts a DDMMAA date string to AAMMDD format.
 *
 * @param {string} ddmma - 6-character date in DDMMAA format.
 * @returns {string} The date in AAMMDD format.
 *
 * @example
 *   toAAMMDD('040626') // → '260406'
 */
function toAAMMDD(ddmma) {
  return ddmma.substring(4, 6) + ddmma.substring(2, 4) + ddmma.substring(0, 2);
}

/**
 * Converts a DDMMAA or AAMMDD date string to a comparable YYYYMMDD number.
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
    // ddmmaa
    dd = dateStr.substring(0, 2);
    mm = dateStr.substring(2, 4);
    aa = dateStr.substring(4, 6);
  }
  return Number(`20${aa}${mm}${dd}`);
}

/**
 * Resolves the effective importe (cents) based on payment date vs due dates.
 *
 * Rule:
 *   - `'1'`             → always use importe1
 *   - `'2'`             → always use importe2
 *   - `'auto'` (default) → importe1 if paid on/before 1st vto, else importe2
 *
 * @param {import('./barcode-parser.js').BarcodeFields} fields
 * @param {string} fechaEmision - Payment date in AAMMDD format (only used in 'auto' mode).
 * @param {'1'|'2'|'auto'} [mode='auto'] - Which importe to use.
 * @returns {number} The importe in integer cents.
 */
function resolveImporte(fields, fechaEmision, mode) {
  // If both due dates are identical, there's only one importe.
  if (fields.fecha1 === fields.fecha2) { return fields.importe1; }

  if (mode === '1') { return fields.importe1; }
  if (mode === '2') { return fields.importe2; }

  // 'auto' — compare payment date vs first due date
  const pagada = toComparableDate(fechaEmision, 'aammdd');
  const vto1 = toComparableDate(fields.fecha1, 'ddmmaa');
  return pagada <= vto1 ? fields.importe1 : fields.importe2;
}

/**
 * Builds a 279-character RAFAMR01 fixed-width record from parsed barcode
 * fields and a Fecha Pago.
 *
 * The barcode is taken directly from the {@code rawBarcode} parameter to avoid
 * reconstruction errors from parsed fields.
 *
 * @param {import('./barcode-parser.js').BarcodeFields} fields - The parsed
 *   barcode fields (ente, fecha1, importe1, fecha2, importe2,
 *   nroComprobante, tipoComprobante, digitoVerificador).
 * @param {string} fechaEmision - Fecha Pago in AAMMDD format (6 chars).
 * @param {string} [rawBarcode] - Original 50-digit barcode. If provided, used
 *   directly for F30 (Codigo de Barra). Falls back to reconstructing from
 *   fields if omitted.
 * @param {'1'|'2'|'auto'} [vencimiento='auto'] - Which due date importe to
 *   use. 'auto' resolves based on payment date vs first due date.
 * @returns {string} A 279-character fixed-width record string.
 *
 * @throws {Error} If `fields` is null or `fechaEmision` is not a valid
 *   6-character string.
 *
 * @example
 *   const fields = parseBarcode('01350406260050601016040626005060101600000192845070');
 *   const record = buildRecord(fields, '260605', '01350406260050601016040626005060101600000192845070', '1');
 *   // record.length === 279
 */
export function buildRecord(fields, fechaEmision, originalBarcode, vencimiento = 'auto') {
  if (!fields) {
    throw new Error('buildRecord: fields parameter is required');
  }

  if (typeof fechaEmision !== 'string' || fechaEmision.length !== 6) {
    throw new Error(
      `buildRecord: fechaEmision must be a 6-character string, got "${fechaEmision}"`,
    );
  }

  const d = resolveConfig();

  // F12 — ente code from barcode substring(0, 4).
  const f12 = fields.ente;

  // F14 — importe resolved from user's vencimiento choice or auto.
  const importePagado = resolveImporte(fields, fechaEmision, vencimiento);
  const f14 = String(importePagado).padStart(11, '0');

  // F22 — fecha1 converted from DDMMAA to AAMMDD.
  const f22 = toAAMMDD(fields.fecha1);

  // F23 — fecha2 converted from DDMMAA to AAMMDD.
  const f23 = toAAMMDD(fields.fecha2);

  // F30 — full 50-digit barcode padded to 60 chars with spaces.
  // Use the original barcode when available (avoids reconstruction errors).
  const rawBarcodeStr = originalBarcode ||
    fields.ente + fields.fecha1 + String(fields.importe1).padStart(10, '0') +
    fields.fecha2 + String(fields.importe2).padStart(10, '0') +
    fields.nroComprobante + fields.tipoComprobante + String(fields.digitoVerificador);
  const f30 = rawBarcodeStr.padEnd(60, ' ');

  // F31 — user-supplied Fecha Pago (already AAMMDD).
  const f31 = fechaEmision;

  // Assemble all 40 fields into the 279-char record.
  const record =
    d.f01 + d.f02 + d.f03 + d.f04 + d.f05 + d.f06 +
    d.f07 + d.f08 + d.f09 + d.f10 + d.f11 +
    f12 +
    d.f13 +
    f14 +
    d.f15 + d.f16 +
    d.f17 + d.f18 + d.f19 + d.f20 + d.f21 +
    f22 + f23 +
    d.f24 + d.f25 + d.f26 + d.f27 + d.f28 + d.f29 +
    f30 +
    f31 +
    d.f32 + d.f33 + d.f34 + d.f35 + d.f36 + d.f37 + d.f38 + d.f39;

  // Defensive assertion: RAFAMR01 records must be exactly 279 chars.
  if (record.length !== 279) {
    throw new Error(
      `RAFAMR01 record must be exactly 279 characters, got ${record.length}. ` +
      `Verify field widths in the configuration.`,
    );
  }

  return record;
}
