/**
 * Button atom component.
 *
 * Renders a styled button element with optional Lucide icon.
 * Follows Pico CSS variant conventions with custom danger variant.
 *
 * @module atoms/Button
 */

/**
 * Renders a styled button with optional icon support.
 *
 * Supported variants map to Pico CSS classes as follows:
 * - 'primary' (default): no extra class (default Pico button style).
 * - 'contrast':     adds `contrast` class.
 * - 'outline':      adds `outline` class.
 * - 'danger':       adds `secondary` + `comp-btn--danger` (red outline).
 *
 * When an {@code icon} is provided, an {@code <i data-lucide="{icon}">}
 * element is prepended to the button. The caller MUST invoke
 * {@code lucide.createIcons()} on the parent container after the element
 * is attached to the DOM to replace placeholders with actual SVGs.
 *
 * @param {Object}   props              - Component properties.
 * @param {string}   props.label        - Visible button text.
 * @param {'primary'|'contrast'|'outline'|'danger'} [props.variant='primary']
 *        Pico CSS style variant.
 * @param {Function} [props.onClick]    - Click event handler (optional).
 * @param {boolean}  [props.disabled=false] - Whether the button is disabled.
 * @param {string}   [props.icon]       - Lucide icon name to render inside
 *        the button (optional).
 * @param {string}   [props.type='button'] - HTML {@code type} attribute.
 * @returns {HTMLButtonElement} A configured button element.
 *
 * @example
 *   // Primary button with icon:
 *   const btn = Button({ label: 'Download', icon: 'download', onClick: handler });
 *   container.append(btn);
 *   lucide.createIcons();
 *
 *   // Danger variant:
 *   const danger = Button({ label: 'Delete', variant: 'danger' });
 */
export function Button({
  label,
  variant = 'primary',
  onClick,
  disabled = false,
  icon,
  type = 'button',
}) {
  const btn = document.createElement('button');
  btn.type = type;
  btn.textContent = label;
  btn.disabled = disabled;

  // Map variants to Pico CSS classes.
  if (variant === 'contrast') {
    btn.classList.add('contrast');
  } else if (variant === 'outline') {
    btn.classList.add('outline');
  } else if (variant === 'danger') {
    btn.classList.add('secondary', 'comp-btn--danger');
  }
  // 'primary' — no extra class needed (Pico default).

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  // Optional Lucide icon prepended before the label text.
  if (icon) {
    const iconEl = document.createElement('i');
    iconEl.setAttribute('data-lucide', icon);
    iconEl.classList.add('comp-btn__icon');
    btn.prepend(iconEl);
  }

  return btn;
}
