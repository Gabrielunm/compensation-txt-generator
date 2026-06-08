/**
 * Shared formatting utilities.
 *
 * @module utils/format
 */

/**
 * Calculates a human-readable file size string.
 *
 * @param {number} bytes - File size in bytes.
 * @returns {string} Formatted size (e.g. `"12.3 MB"`).
 */
export function formatSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Formats an integer cent amount as a peso string with commas.
 *
 * @param {number} cents - Amount in integer cents.
 * @returns {string} e.g. `"$50,601.01"`.
 */
export function formatImporte(cents) {
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const sign = cents < 0 ? '-' : '';
  return `${sign}$${whole.toLocaleString('en-US')}.${frac}`;
}

/**
 * Formats a YYYY-MM-DD date string to DD/MM/YYYY.
 *
 * @param {string} isoDate - ISO date string.
 * @returns {string} Formatted date (e.g. `"08/06/2026"`).
 */
export function formatDate(isoDate) {
  if (!isoDate) {
    return '';
  }
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}
