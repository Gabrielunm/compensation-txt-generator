/**
 * Badge atom component.
 *
 * Renders a coloured status badge as a `<span>` element.
 * Returns an empty document fragment (nothing visible) when the text
 * is empty — safe to append anywhere without conditional checks.
 *
 * @module atoms/Badge
 */

/**
 * Maps badge variant names to CSS class suffixes.
 *
 * @type {Object<string, string>}
 */
const VARIANT_CLASS = {
  success: 'badge--success',
  error: 'badge--error',
  warning: 'badge--warning',
  info: 'badge--info',
  neutral: 'badge--neutral',
};

/**
 * Renders a colour-coded status badge.
 *
 * @param {Object} props               - Component properties.
 * @param {string} props.text          - Badge label text. When falsy/empty
 *        the component renders an invisible document fragment.
 * @param {'success'|'error'|'warning'|'info'|'neutral'} [props.variant='neutral']
 *        Determines the badge colour.
 * @returns {HTMLSpanElement|DocumentFragment} A span element with badge
 *         classes, or an empty fragment when {@code text} is empty.
 *
 * @example
 *   // Success badge:
 *   Badge({ text: 'Valid', variant: 'success' });
 *
 *   // Hidden badge (no output):
 *   Badge({ text: '', variant: 'success' }); // → DocumentFragment
 */
export function Badge({ text, variant = 'neutral' }) {
  // Return an invisible fragment when there is nothing to display.
  // This avoids conditionals in callers that always append the result.
  if (!text) {
    return document.createDocumentFragment();
  }

  const variantClass = VARIANT_CLASS[variant] || VARIANT_CLASS.neutral;

  const span = document.createElement('span');
  span.className = `badge ${variantClass}`;
  span.textContent = text;

  return span;
}
