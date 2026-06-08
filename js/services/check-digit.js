/**
 * Formato 50 check-digit validation service.
 *
 * Implements the RAFAM Formato 50 algorithm for verifying the check digit
 * (digito verificador) of a 50-digit barcode.
 *
 * Algorithm (verified against 99 production barcodes):
 *   1. Take the 49-digit prefix (positions 0–48).
 *   2. Starting from the RIGHTMOST digit (index 48), double every second
 *      digit (positions 49, 47, 45, … from left / 1st, 3rd, 5th, … from right).
 *   3. Sum doubled products directly (not digit-wise). E.g. 6 × 2 = 12 → add 12.
 *   4. Sum non-doubled digits directly.
 *   5. total = sum_doubled + sum_non_doubled.
 *   6. digitSum = sum of the decimal digits of `total`.
 *   7. DV = (10 - (digitSum % 10)) % 10.
 *
 * @module services/check-digit
 */

/**
 * Result of a check-digit validation.
 *
 * @typedef {Object} CheckDigitResult
 * @property {boolean} isValid  - Whether the computed digit matches the
 *   barcode's last digit.
 * @property {number}  calc     - The check digit calculated by the algorithm.
 * @property {number}  expected - The check digit read from the barcode
 *   (position 50, 1-indexed).
 */

/**
 * Validates the check digit of a 50-digit Formato 50 barcode.
 *
 * The 50th digit is the expected check digit. The function computes the
 * check digit from the first 49 digits using the Formato 50 algorithm and
 * compares it with the expected value.
 *
 * @param {string} barcode - A 50-digit barcode string.
 * @returns {CheckDigitResult} Validation result with calculated and expected
 *   check digits.
 *
 * @throws {Error} If the barcode is not a 50-digit string.
 *
 * @example
 *   const result = validateCheckDigit('01350406260050601016040626005060101600000192845070');
 *   // { isValid: true, calc: 0, expected: 0 }
 */
export function validateCheckDigit(barcode) {
  if (typeof barcode !== 'string' || barcode.length !== 50 || !/^\d{50}$/.test(barcode)) {
    throw new Error(
      `validateCheckDigit expected a 50-digit string, got "${barcode}" (length ${barcode.length})`,
    );
  }

  const expected = Number.parseInt(barcode.charAt(49), 10);
  const calc = computeCheckDigit(barcode.substring(0, 49));

  return {
    isValid: calc === expected,
    calc,
    expected,
  };
}

/**
 * Computes the Formato 50 check digit from a 49-digit prefix.
 *
 * @param {string} prefix - 49-character numeric string.
 * @returns {number} The computed check digit (0–9).
 */
function computeCheckDigit(prefix) {
  let sumDoubled = 0;
  let sumNonDoubled = 0;

  // Iterate from RIGHTMOST digit (index 48) toward the left.
  for (let i = prefix.length - 1; i >= 0; i--) {
    const digit = Number.parseInt(prefix.charAt(i), 10);
    const positionFromRight = prefix.length - i; // 1-indexed from right

    if (positionFromRight % 2 === 1) {
      // Odd position from right: double the digit and add the product directly
      // (not digit-wise — e.g. 6×2 = 12, add 12, not 1 + 2 = 3).
      sumDoubled += digit * 2;
    } else {
      // Even position from right: add the digit directly.
      sumNonDoubled += digit;
    }
  }

  const total = sumDoubled + sumNonDoubled;

  // Sum the decimal digits of the total (e.g. 109 → 1 + 0 + 9 = 10).
  const totalStr = String(total);
  let digitSum = 0;

  for (let i = 0; i < totalStr.length; i++) {
    digitSum += Number.parseInt(totalStr.charAt(i), 10);
  }

  // DV = (10 - digitSum % 10) % 10
  // When digitSum % 10 === 0, DV = 0.
  const checkDigit = (10 - (digitSum % 10)) % 10;

  return checkDigit;
}
