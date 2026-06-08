/**
 * Tests for RAFAMR01 record builder service.
 *
 * Verifies fixed-width 279-character record construction, field positions,
 * date conversion (DDMMAA → AAMMDD), importe truncation/padding, and
 * error handling.
 *
 * @jest-environment node
 */
import { describe, it, expect, beforeAll } from '@jest/globals';
import { z } from 'zod';
import { parseBarcode } from '../services/barcode-parser.js';
import { buildRecord, DEFAULT_CONFIG } from '../services/rafam-builder.js';

// Set global `Zod` before any test runs (simulating browser CDN).
beforeAll(() => {
  globalThis.Zod = z;
});

/**
 * Canonical barcode from spec + design examples.
 */
const SPEC_BARCODE = '01350406260050601016040626005060101600000192845070';
const FECHA_EMISION = '260604'; // AAMMDD — same as 1st due date (pays on time → importe1)

describe('buildRecord()', () => {
  it('throws error when fields is null', () => {
    expect(() => buildRecord(null, FECHA_EMISION)).toThrow();
  });

  it('throws error when fechaEmision is missing', () => {
    const fields = parseBarcode(SPEC_BARCODE);
    expect(() => buildRecord(fields)).toThrow();
  });

  it('throws error when fechaEmision has wrong length', () => {
    const fields = parseBarcode(SPEC_BARCODE);
    expect(() => buildRecord(fields, '2606051')).toThrow();
  });

  it('returns a string of exactly 279 characters', () => {
    const fields = parseBarcode(SPEC_BARCODE);
    const record = buildRecord(fields, FECHA_EMISION);
    expect(typeof record).toBe('string');
    expect(record).toHaveLength(279);
  });

  describe('record field positions', () => {
    /** @type {string} */
    let record;

    beforeAll(() => {
      const fields = parseBarcode(SPEC_BARCODE);
      record = buildRecord(fields, FECHA_EMISION);
    });

    it('F01 [001-008]: starts with RAFAMR01', () => {
      expect(record.substring(0, 8)).toBe('RAFAMR01');
    });

    it('F02 [009-012]: is 0000', () => {
      expect(record.substring(8, 12)).toBe('0000');
    });

    it('F03 [013]: is R', () => {
      expect(record.charAt(12)).toBe('R');
    });

    it('F04 [014-018]: is 00001', () => {
      expect(record.substring(13, 18)).toBe('00001');
    });

    it('F05 [019-028]: is 10 spaces', () => {
      expect(record.substring(18, 28)).toBe('          ');
    });

    it('F06 [029-032]: is 0001', () => {
      expect(record.substring(28, 32)).toBe('0001');
    });

    it('F07 [033-040]: is 00000000', () => {
      expect(record.substring(32, 40)).toBe('00000000');
    });

    it('F08 [041-048]: is 00000000', () => {
      expect(record.substring(40, 48)).toBe('00000000');
    });

    it('F09 [049-050]: is A3', () => {
      expect(record.substring(48, 50)).toBe('A3');
    });

    it('F10-F11 [051-054]: is 0000', () => {
      expect(record.substring(50, 54)).toBe('0000');
    });

    it('F12 [055-058]: is ente code 0135', () => {
      expect(record.substring(54, 58)).toBe('0135');
    });

    it('F13 [059-077]: is 19 zeros', () => {
      expect(record.substring(58, 77)).toBe('0000000000000000000');
    });

    it('F14 [078-088]: importe1 padded to 11 chars', () => {
      expect(record.substring(77, 88)).toBe('00050601016');
    });

    it('F15 [089-099]: is 11 zeros', () => {
      expect(record.substring(88, 99)).toBe('00000000000');
    });

    it('F16 [100-110]: is 11 zeros', () => {
      expect(record.substring(99, 110)).toBe('00000000000');
    });

    it('F17 [111]: is 0 (Pesos)', () => {
      expect(record.charAt(110)).toBe('0');
    });

    it('F18 [112-115]: is 0000', () => {
      expect(record.substring(111, 115)).toBe('0000');
    });

    it('F19 [116-118]: is 000', () => {
      expect(record.substring(115, 118)).toBe('000');
    });

    it('F20 [119-120]: is 2 spaces', () => {
      expect(record.substring(118, 120)).toBe('  ');
    });

    it('F21 [121-123]: is 000', () => {
      expect(record.substring(120, 123)).toBe('000');
    });

    it('F22 [124-129]: fecha1 converted to AAMMDD', () => {
      // barcode[4..10] = '040626' (DDMMAA) → AAMMDD = '260604'
      expect(record.substring(123, 129)).toBe('260604');
    });

    it('F23 [130-135]: fecha2 converted to AAMMDD', () => {
      // barcode[20..26] = '040626' (DDMMAA) → AAMMDD = '260604'
      expect(record.substring(129, 135)).toBe('260604');
    });

    it('F24 [136-138]: is 000', () => {
      expect(record.substring(135, 138)).toBe('000');
    });

    it('F25 [139-141]: is 000', () => {
      expect(record.substring(138, 141)).toBe('000');
    });

    it('F26 [142-145]: is 0000', () => {
      expect(record.substring(141, 145)).toBe('0000');
    });

    it('F27 [146-153]: is 00000000', () => {
      expect(record.substring(145, 153)).toBe('00000000');
    });

    it('F28 [154-161]: is 00000000', () => {
      expect(record.substring(153, 161)).toBe('00000000');
    });

    it('F29 [162-164]: is 000', () => {
      expect(record.substring(161, 164)).toBe('000');
    });

    it('F30 [165-224]: barcode padded to 60', () => {
      const f30 = record.substring(164, 224);
      expect(f30).toHaveLength(60);
      expect(f30.substring(0, 50)).toBe(SPEC_BARCODE);
      expect(f30.substring(50)).toBe(' '.repeat(10));
    });

    it('F31 [225-230]: fechaEmision as-is', () => {
      expect(record.substring(224, 230)).toBe(FECHA_EMISION);
    });

    it('F32 [231]: is 0', () => {
      expect(record.charAt(230)).toBe('0');
    });

    it('F33 [232-238]: is 0000000', () => {
      expect(record.substring(231, 238)).toBe('0000000');
    });

    it('F34 [239-247]: is 000000000', () => {
      expect(record.substring(238, 247)).toBe('000000000');
    });

    it('F35 [248-249]: is 00', () => {
      expect(record.substring(247, 249)).toBe('00');
    });

    it('F36 [250-253]: is 0000', () => {
      expect(record.substring(249, 253)).toBe('0000');
    });

    it('F37 [254-256]: is 3 spaces', () => {
      expect(record.substring(253, 256)).toBe('   ');
    });

    it('F38 [257-271]: is 15 spaces', () => {
      expect(record.substring(256, 271)).toBe('               ');
    });

    it('F39 [272-279]: is 00000000', () => {
      expect(record.substring(271, 279)).toBe('00000000');
    });
  });

  describe('DEFAULT_CONFIG exports', () => {
    it('contains all required hardcoded fields', () => {
      expect(DEFAULT_CONFIG.f01).toBe('RAFAMR01');
      expect(DEFAULT_CONFIG.f02).toBe('0000');
      expect(DEFAULT_CONFIG.f03).toBe('R');
      expect(DEFAULT_CONFIG.f04).toBe('00001');
      expect(DEFAULT_CONFIG.f05).toBe('          ');
      expect(DEFAULT_CONFIG.f06).toBe('0001');
      expect(DEFAULT_CONFIG.f07).toBe('00000000');
      expect(DEFAULT_CONFIG.f08).toBe('00000000');
      expect(DEFAULT_CONFIG.f09).toBe('A3');
      expect(DEFAULT_CONFIG.f10).toBe('00');
      expect(DEFAULT_CONFIG.f11).toBe('00');
      expect(DEFAULT_CONFIG.f13).toBe('0000000000000000000');
      expect(DEFAULT_CONFIG.f15).toBe('00000000000');
      expect(DEFAULT_CONFIG.f16).toBe('00000000000');
      expect(DEFAULT_CONFIG.f17).toBe('0');
      expect(DEFAULT_CONFIG.f18).toBe('0000');
      expect(DEFAULT_CONFIG.f19).toBe('000');
      expect(DEFAULT_CONFIG.f20).toBe('  ');
      expect(DEFAULT_CONFIG.f21).toBe('000');
      expect(DEFAULT_CONFIG.f24).toBe('000');
      expect(DEFAULT_CONFIG.f25).toBe('000');
      expect(DEFAULT_CONFIG.f26).toBe('0000');
      expect(DEFAULT_CONFIG.f27).toBe('00000000');
      expect(DEFAULT_CONFIG.f28).toBe('00000000');
      expect(DEFAULT_CONFIG.f29).toBe('000');
      expect(DEFAULT_CONFIG.f32).toBe('0');
      expect(DEFAULT_CONFIG.f33).toBe('0000000');
      expect(DEFAULT_CONFIG.f34).toBe('000000000');
      expect(DEFAULT_CONFIG.f35).toBe('00');
      expect(DEFAULT_CONFIG.f36).toBe('0000');
      expect(DEFAULT_CONFIG.f37).toBe('   ');
      expect(DEFAULT_CONFIG.f38).toBe('               ');
      expect(DEFAULT_CONFIG.f39).toBe('00000000');
    });
  });

  describe('edge cases', () => {
    it('handles different importe values with correct truncation', () => {
      const smallImporteBarcode =
        '01350406260000000123040626005060101600000192845070';
      const fields = parseBarcode(smallImporteBarcode);
      const record = buildRecord(fields, FECHA_EMISION);
      expect(record.substring(77, 88)).toBe('00000000123');
    });

    it('handles max importe value', () => {
      const maxImporteBarcode =
        '01350406269999999999040626005060101600000192845070';
      const fields = parseBarcode(maxImporteBarcode);
      const record = buildRecord(fields, FECHA_EMISION);
      // padStart(11,'0') on 10-digit '9999999999' → '09999999999'
      expect(record.substring(77, 88)).toBe('09999999999');
    });

    it('converts different fecha values correctly', () => {
      const fechaBarcode =
        '01353112250050601016040626005060101600000192845070';
      const fields = parseBarcode(fechaBarcode);
      const record = buildRecord(fields, FECHA_EMISION);
      expect(record.substring(123, 129)).toBe('251231');
    });
  });
});
