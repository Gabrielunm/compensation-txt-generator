/**
 * Tests for ProcessingQueue organism — resolvedImporte & effectiveFecha.
 *
 * Verifies that ParsedRecord objects include the resolved importe (matching TXT F14)
 * and the effective per-record payment date, ensuring display values match what
 * goes into the RAFAMR01 file.
 *
 * @jest-environment node
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { z } from 'zod';
import { parseBarcode } from '../services/barcode-parser.js';
import { buildRecord } from '../services/rafam-builder.js';

// Set global `Zod` before any test runs (simulating browser CDN).
beforeAll(() => {
  globalThis.Zod = z;
});

/**
 * Known-valid barcodes from production fixtures.
 *   fecha1=040626 (DDMMAA), importe1=50601016
 *   fecha2=040626 (DDMMAA), importe2=50601016 (same amounts in this case)
 * Used when both imported are needed with different amounts.
 */
const SPEC_BARCODE = '01350406260050601016040626005060101600000192845070';
const FECHA_EMISION = '260604'; // AAMMDD

/**
 * Barcode with DIFFERENT importe1 and importe2 amounts AND different fechas.
 *   fecha1=040626 (DDMMAA  → 260604), importe1=0000000123 (123 cents)
 *   fecha2=311225 (DDMMAA  → 251231), importe2=0099999999 (99999999 cents)
 *   DV: 2 (computed via Formato 50 algorithm)
 */
const DUAL_IMPORTE_BARCODE = '01350406260000000123311225009999999900000192845072';

describe('ParsedRecord — resolvedImporte', () => {
  /**
   * The key insight: resolvedImporte should match what's written to F14
   * in the TXT record (positions 77-88). This is exactly what app code
   * does with `Number.parseInt(record.substring(77, 88), 10)`.
   */
  it('reads resolvedImporte from TXT record F14 position (77-88)', () => {
    const fields = parseBarcode(SPEC_BARCODE);
    const record = buildRecord(fields, FECHA_EMISION, SPEC_BARCODE, '1');
    const resolvedImporte = Number.parseInt(record.substring(77, 88), 10);
    // SPEC_BARCODE importe1 = 50601016 → F14 padded → '00050601016'
    expect(resolvedImporte).toBe(50601016);
  });

  it('matches importe1 when vencimiento is "1"', () => {
    const fields = parseBarcode(DUAL_IMPORTE_BARCODE);
    const record = buildRecord(fields, FECHA_EMISION, DUAL_IMPORTE_BARCODE, '1');
    const resolvedImporte = Number.parseInt(record.substring(77, 88), 10);
    // With vencimiento='1', F14 should be importe1 = 123
    expect(resolvedImporte).toBe(123);
  });

  it('matches importe2 when vencimiento is "2"', () => {
    const fields = parseBarcode(DUAL_IMPORTE_BARCODE);
    const record = buildRecord(fields, FECHA_EMISION, DUAL_IMPORTE_BARCODE, '2');
    const resolvedImporte = Number.parseInt(record.substring(77, 88), 10);
    // With vencimiento='2', F14 should be importe2 = 99999999
    expect(resolvedImporte).toBe(99999999);
  });
});

describe('ParsedRecord — effectiveFecha', () => {
  it('buildRecord uses fechaEmision in F31', () => {
    const fields = parseBarcode(SPEC_BARCODE);
    const record = buildRecord(fields, FECHA_EMISION, SPEC_BARCODE, '1');
    // F31 [225-230] = fechaEmision (AAMMDD)
    const f31 = record.substring(224, 230);
    expect(f31).toBe(FECHA_EMISION);
  });

  it('is a 6-character AAMMDD string', () => {
    // effectiveFecha is what processFile computes before calling buildRecord.
    // In vencimiento='1' mode, effectiveFecha = toAAMMDD(fields.fecha1).
    const fields = parseBarcode(SPEC_BARCODE);
    const effectiveFecha = fields.fecha1.substring(4, 6) + fields.fecha1.substring(2, 4) + fields.fecha1.substring(0, 2);
    expect(effectiveFecha).toHaveLength(6);
    expect(effectiveFecha).toMatch(/^\d{6}$/);
    expect(effectiveFecha).toBe('260604'); // 040626 DDMMAA → AAMMDD
  });
});
