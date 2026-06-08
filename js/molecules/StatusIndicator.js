/**
 * StatusIndicator molecule component.
 *
 * Renders a progress bar with a status label using Pico CSS
 * `<progress>` element. The component is hidden when {@code total}
 * is zero (no items to process).
 *
 * Visual states:
 * - **idle**: Default styling, progress value at 0.
 * - **processing**: Animated fill (Pico CSS default).
 * - **done**: Green-tinted progress bar.
 * - **error**: Red-tinted progress bar (class `progress--error`).
 *
 * @module molecules/StatusIndicator
 */

/**
 * Maps status values to additional CSS classes on the container.
 *
 * @type {Object<string, string>}
 */
const STATUS_CLASS = {
  processing: 'comp-status--processing',
  done: 'comp-status--done',
  error: 'comp-status--error',
};

/**
 * Renders a progress indicator with current/total counter.
 *
 * @param {Object} props               - Component properties.
 * @param {number} props.current       - Current progress count (0-based).
 * @param {number} props.total         - Total items to process.
 * @param {'idle'|'processing'|'done'|'error'} [props.status='idle']
 *        Processing state affecting the visual style.
 * @param {string} [props.label]       - Optional label shown below the
 *        progress bar. Defaults to {@code "N / M processed"}.
 * @returns {HTMLElement|DocumentFragment} A progress indicator element,
 *          or a document fragment (hidden) when {@code total === 0}.
 *
 * @example
 *   // Processing 5 of 10:
 *   StatusIndicator({ current: 5, total: 10, status: 'processing' });
 *
 *   // All done:
 *   StatusIndicator({ current: 10, total: 10, status: 'done' });
 *
 *   // Hidden (total = 0):
 *   StatusIndicator({ current: 0, total: 0, status: 'idle' });
 */
export function StatusIndicator({ current, total, status = 'idle', label }) {
  if (total === 0) {
    return document.createDocumentFragment();
  }

  const container = document.createElement('div');
  container.className = 'comp-status';

  // Apply status-specific class.
  const statusClass = STATUS_CLASS[status];
  if (statusClass) {
    container.classList.add(statusClass);
  }

  // --- Progress element ---
  const progress = document.createElement('progress');
  progress.value = current;
  progress.max = total;
  container.append(progress);

  // --- Status label ---
  const labelEl = document.createElement('p');
  labelEl.className = 'comp-status__label';
  labelEl.textContent = label || `${current} / ${total} processed`;
  container.append(labelEl);

  return container;
}
