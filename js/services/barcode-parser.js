/**
 * Formato 50 barcode parser service.
 *
 * Parses a 50-digit barcode into its constituent fields according to the
 * Formato 50 specification, with Zod runtime validation.
 *
 * Field layout (0-indexed positions):
 *   ente             [0..4)     —  4 digits  —  Entity code
 *   fecha1           [4..10)    —  6 digits  —  First due date (DDMMAA)
 *   importe1         [10..20)   — 10 digits  —  First amount (integer cents)
 *   fecha2           [20..26)   —  6 digits  —  Second due date (DDMMAA)
 *   importe2         [26..36)   — 10 digits  —  Second amount (integer cents)
 *   nroComprobante   [36..47)   — 11 digits  —  Voucher number
 *   tipoComprobante  [47..49)   —  2 digits  —  Voucher type (e.g. "07")
 *   digitoVerificador [49]      —  1 digit   —  Check digit
 *
 * @module services/barcode-parser
 */

/**
 * Parsed fields from a Formato 50 barcode.
 *
 * @typedef {Object} BarcodeFields
 * @property {string} ente             - Entity code (4 digits).
 * @property {string} fecha1           - First due date in DDMMAA format.
 * @property {number} importe1         - First amount in integer cents.
 * @property {string} fecha2           - Second due date in DDMMAA format.
 * @property {number} importe2         - Second amount in integer cents.
 * @property {string} nroComprobante   - Voucher number (11 digits).
 * @property {string} tipoComprobante  - Voucher type (2 digits).
 * @property {number} digitoVerificador - Check digit (0–9).
 */

/**
 * Lazily-initialized Zod schema for 50-digit barcode validation.
 *
 * Uses a getter so the module loads without requiring the global `Zod` to be
 * present at import time (important for test environments). In the browser,
 * Zod is loaded via CDN as a global before this module is called.
 *
 * @type {import('zod').ZodString|null}
 */
let _barcodeSchema = null;

/**
 * Returns the Zod schema, creating it lazily on first access.
 *
 * @returns {import('zod').ZodString}
 * @throws {Error} If `Zod` (Zod global) is not available.
 */
function getSchema() {
  if (!_barcodeSchema) {
    if (typeof Zod === 'undefined') {
      throw new Error(
        'Zod global (Zod) is not available. Ensure Zod is loaded via CDN before calling parseBarcode().',
      );
    }

    _barcodeSchema = Zod.string().length(50).regex(/^\d{50}$/);
  }

  return _barcodeSchema;
}

/**
 * Parses a 50-digit Formato 50 barcode into typed fields.
 *
 * Optionally validates that the entity code matches an expected value (e.g.,
 * `'0135'` for Hurlingham municipality).
 *
 * @param {string} barcode - The 50-digit barcode to parse.
 * @param {Object} [options] - Optional validation constraints.
 * @param {string} [options.expectedEnte] - If set, throws if the barcode's
 *     entity code does not match this value.
 * @returns {BarcodeFields} Parsed fields with typed values.
 *
 * @throws {Error} If the barcode is invalid (wrong length or non-numeric).
 * @throws {Error} If `expectedEnte` is set and the entity code does not match.
 *
 * @example
 *   // Parse without entity validation:
 *   const fields = parseBarcode('01350406260050601016040626005060101600000192845070');
 *
 *   // Parse and validate entity is Hurlingham (0135):
 *   const fields = parseBarcode(barcode, { expectedEnte: '0135' });
 */
export function parseBarcode(barcode, options = {}) {
  // Runtime validation via Zod (schema is lazily initialized).
  const result = getSchema().safeParse(barcode);

  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => issue.message)
      .join('; ');

    throw new Error(`Invalid barcode: ${issues}`);
  }

  const fields = {
    ente: barcode.substring(0, 4),
    fecha1: barcode.substring(4, 10),
    importe1: Number.parseInt(barcode.substring(10, 20), 10),
    fecha2: barcode.substring(20, 26),
    importe2: Number.parseInt(barcode.substring(26, 36), 10),
    nroComprobante: barcode.substring(36, 47),
    tipoComprobante: barcode.substring(47, 49),
    digitoVerificador: Number.parseInt(barcode.charAt(49), 10),
  };

  if (options.expectedEnte && fields.ente !== options.expectedEnte) {
    throw new Error(
      `Invalid entity code: expected "${options.expectedEnte}", ` +
      `got "${fields.ente}". Only comprobantes with entity code ` +
      `"${options.expectedEnte}" are accepted.`,
    );
  }

  return fields;
}
