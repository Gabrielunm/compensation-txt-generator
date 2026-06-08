/**
 * Icon atom component.
 *
 * Wraps a Lucide icon reference in a `<i data-lucide="{name}">` element.
 * After the returned element is attached to the DOM, the caller MUST invoke
 * {@code lucide.createIcons()} to replace placeholder elements with actual
 * SVG icons.
 *
 * If Lucide is not available (global `lucide` undefined), the component
 * falls back to an empty `<span>` with a warning class.
 *
 * @module atoms/Icon
 */

/**
 * Renders a Lucide icon element.
 *
 * @param {Object} props          - Component properties.
 * @param {string} props.name     - Lucide icon name (e.g. `'download'`,
 *        `'check'`, `'x'`).
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Icon size variant.
 * @returns {HTMLElement} Either an `<i data-lucide="...">` element when
 *          Lucide is available, or an empty `<span>` with the class
 *          `comp-icon--fallback` when it is not.
 *
 * @example
 *   const icon = Icon({ name: 'check', size: 'sm' });
 *   container.append(icon);
 *   lucide.createIcons();
 */
export function Icon({ name, size = 'md' }) {
  if (typeof lucide === 'undefined') {
    // Graceful fallback when Lucide CDN has not loaded.
    const fallback = document.createElement('span');
    fallback.className = 'comp-icon--fallback';
    return fallback;
  }

  const iconEl = document.createElement('i');
  iconEl.setAttribute('data-lucide', name);
  iconEl.classList.add('comp-icon', `comp-icon--${size}`);

  return iconEl;
}
