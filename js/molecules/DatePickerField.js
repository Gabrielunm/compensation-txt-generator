/**
 * DatePickerField molecule component.
 *
 * Renders a labelled native `<input type="date">` with inline validation.
 * The component enforces:
 *   1. Fecha Emisión ≤ today.
 *   2. Optional custom min/max bounds.
 *
 * Validation errors are displayed inline using Pico CSS
 * {@code [aria-invalid="true"]} styling on the input element.
 *
 * @module molecules/DatePickerField
 */

/**
 * Returns today's date as a YYYY-MM-DD string (local timezone).
 *
 * @returns {string} e.g. `"2026-06-08"`.
 */
function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

import { formatDate } from '../utils/format.js';

/**
 * Renders a labelled date input with inline validation.
 *
 * When validation fails (date violates min/max bounds), the input receives
 * {@code aria-invalid="true"} and an error message is shown below it.
 * The {@code onChange} callback is only invoked with a valid date string.
 *
 * @param {Object} props              - Component properties.
 * @param {Function} props.onChange
 *        Callback invoked with {@code (dateString: string)} when the user
 *        selects a valid date. The date is in YYYY-MM-DD format.
 * @param {string} [props.minDate]
 *        Minimum allowed date as YYYY-MM-DD. Defaults to ISO string of
 *        today minus 30 days.
 * @param {string} [props.maxDate]
 *        Maximum allowed date as YYYY-MM-DD. Defaults to today.
 * @param {string} [props.label='Fecha Pago']
 *        Visible label text for the input.
 * @returns {HTMLElement} A field container element with label, input,
 *          and optional error message.
 *
 * @example
 *   const field = DatePickerField({
 *     onChange: (date) => console.log('Selected:', date),
 *   });
 *   container.append(field);
 */
export function DatePickerField({
  onChange,
  minDate,
  maxDate,
  label = 'Fecha de Emisión',
}) {
  const container = document.createElement('div');
  container.className = 'comp-date-field';

  // --- Label ---
  const labelEl = document.createElement('label');
  labelEl.textContent = label;
  container.append(labelEl);

  // --- Input ---
  const input = document.createElement('input');
  input.type = 'date';
  input.className = 'comp-date-field__input';
  input.min = minDate || '';
  input.max = maxDate || todayISO();
  input.value = todayISO(); // Default to today
  container.append(input);

  // Fire onChange with default value so the app has it immediately.
  // Use setTimeout to let the parent mount and attach listeners first.
  setTimeout(() => onChange(input.value), 0);

  // --- Error message ---
  const errorEl = document.createElement('p');
  errorEl.className = 'comp-date-field__error';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;
  container.append(errorEl);

  /**
   * Validates the current input value and updates the error state.
   *
   * @returns {boolean} True if the value is valid.
   */
  function validate() {
    const val = input.value;
    errorEl.hidden = true;
    input.removeAttribute('aria-invalid');

    if (!val) {
      // Empty date is not valid — wait for user input.
      return false;
    }

    const effectiveMax = maxDate || todayISO();

    if (effectiveMax && val > effectiveMax) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = `La fecha no puede ser posterior a ${formatDate(effectiveMax)}.`;
      errorEl.hidden = false;
      return false;
    }

    if (minDate && val < minDate) {
      input.setAttribute('aria-invalid', 'true');
      errorEl.textContent = `La fecha no puede ser anterior a ${formatDate(minDate)}.`;
      errorEl.hidden = false;
      return false;
    }

    return true;
  }

  // --- Change handler ---
  input.addEventListener('change', () => {
    if (validate()) {
      onChange(input.value);
    }
  });

  return container;
}
