/**
 * UploadPanel organism component.
 *
 * Composes FileDropZone, DatePickerField, and Button into a unified
 * file upload interface. Manages the file collection internally,
 * displays a removable file list, and emits batch processing requests.
 *
 * State flow:
 * - **idle**: Drop zone visible, date picker and button disabled.
 * - **has-files**: File list visible with remove buttons, date picker
 *   enabled, "Generate TXT" button active when both files and a date
 *   are set.
 *
 * @module organisms/UploadPanel
 */

import { Button } from '../atoms/Button.js';
import { FileDropZone } from '../molecules/FileDropZone.js';
import { DatePickerField } from '../molecules/DatePickerField.js';
import { formatSize } from '../utils/format.js';

/**
 * Renders the upload panel with file management and date selection.
 *
 * @param {Object} props            - Component properties.
 * @param {Function} props.onProcess
 *        Callback invoked with {@code (files: File[], fechaEmision: string)}
 *        when the user clicks "Generate TXT".
 * @returns {HTMLElement} The upload panel container element.
 *
 * @example
 *   const panel = UploadPanel({
 *     onProcess: (files, date) => processBatch(files, date),
 *   });
 *   document.getElementById('upload').append(panel);
 */
export function UploadPanel({ onProcess }) {
  const container = document.createElement('div');
  container.className = 'comp-upload-panel';

  // --- State ---
  /** @type {File[]} */
  let files = [];
  /** @type {string|null} */
  let fechaEmision = null;

  // --- File drop zone ---
  const dropZone = FileDropZone({
    onFilesSelected: (newFiles) => {
      files = files.concat(newFiles);
      renderFileList();
      updateButtonState();
    },
  });
  container.append(dropZone);

  // --- Vencimiento selector (mutually exclusive checkboxes) ---
  const vtoContainer = document.createElement('div');
  vtoContainer.className = 'vto-selector';

  const vtoLegend = document.createElement('span');
  vtoLegend.className = 'vto-selector__legend';
  vtoLegend.textContent = 'Vencimiento a aplicar:';
  vtoContainer.append(vtoLegend);

  let vencimiento = 'auto';

  function makeVtoCheckbox(id, label, value) {
    const labelEl = document.createElement('label');
    labelEl.className = 'vto-selector__label';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = id;
    cb.className = 'vto-selector__input';

    cb.addEventListener('change', () => {
      if (cb.checked) {
        vencimiento = value;
        document.querySelectorAll('.vto-selector__input').forEach((other) => {
          if (other.id !== id) { other.checked = false; }
        });
      } else {
        vencimiento = 'auto';
      }
      dateHint.hidden = vencimiento === 'auto';
    });

    labelEl.append(cb, ` ${label}`);
    vtoContainer.append(labelEl);
  }

  makeVtoCheckbox('vto1', '1er vencimiento', '1');
  makeVtoCheckbox('vto2', '2do vencimiento', '2');
  const vtoHint = document.createElement('small');
  vtoHint.className = 'vto-selector__hint';
  vtoHint.textContent = 'Si no se selecciona ninguno, se elige automáticamente según la fecha de pago.';
  vtoContainer.append(vtoHint);
  container.append(vtoContainer);

  // --- File list ---
  const fileListContainer = document.createElement('div');
  fileListContainer.className = 'comp-upload-panel__file-list';
  fileListContainer.setAttribute('aria-live', 'polite');
  container.append(fileListContainer);

  // --- Date picker ---
  const dateField = DatePickerField({
    label: 'Fecha Pago',
    onChange: (date) => {
      fechaEmision = date;
      updateButtonState();
    },
  });
  container.append(dateField);

  const dateHint = document.createElement('small');
  dateHint.className = 'date-hint';
  dateHint.textContent = 'La fecha se usa solo para el registro RAFAM (campo Fecha Pago).';
  dateHint.hidden = true;
  container.append(dateHint);

  // --- Generate button ---
  const generateBtn = Button({
    label: 'Generar TXT',
    icon: 'file-text',
    disabled: true,
    variant: 'primary',
  });
  container.append(generateBtn);

  // --- Clear button ---
  const clearBtn = Button({
    label: 'Clear All',
    variant: 'outline',
    onClick: () => {
      files = [];
      fechaEmision = null;
      vencimiento = 'auto';
      document.querySelectorAll('.vto-selector__input').forEach((cb) => { cb.checked = false; });
      dateHint.hidden = true;
      renderFileList();
      updateButtonState();
    },
  });
  container.append(clearBtn);

  // --- Generate handler ---
  generateBtn.addEventListener('click', () => {
    if (files.length > 0 && fechaEmision) {
      onProcess(files, fechaEmision, vencimiento);
    }
  });

  /**
   * Renders the file list — summary bar + expandable detail list.
   *
   * When there are many files (>20), individual entries are hidden behind
   * a "Show details" toggle to keep the UI clean. The summary bar always
   * shows total count and size at a glance.
   */
  function renderFileList() {
    fileListContainer.textContent = '';

    if (files.length === 0) {
      return;
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0);

    // --- Summary bar ---
    const summary = document.createElement('div');
    summary.className = 'file-summary';

    const summaryText = document.createElement('span');
    summaryText.className = 'file-summary__text';
    summaryText.textContent =
      `${files.length} archivo${files.length !== 1 ? 's' : ''} · ${formatSize(totalBytes)}`;

    const clearBtn = document.createElement('button');
    clearBtn.className = 'file-summary__clear';
    clearBtn.textContent = 'Limpiar todo';
    clearBtn.addEventListener('click', () => {
      files = [];
      fechaEmision = null;
      renderFileList();
      updateButtonState();
    });

    summary.append(summaryText, clearBtn);
    fileListContainer.append(summary);

    // --- Individual file list (expandable) ---
    const showIndividual = files.length <= 20;
    const listWrapper = document.createElement('div');
    listWrapper.className = 'file-list-detail';
    listWrapper.hidden = !showIndividual;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const item = document.createElement('div');
      item.className = 'file-item';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-item__name';
      nameSpan.textContent = file.name;

      const sizeSpan = document.createElement('span');
      sizeSpan.className = 'file-item__size';
      sizeSpan.textContent = formatSize(file.size);

      const removeBtn = document.createElement('button');
      removeBtn.className = 'comp-upload-panel__remove-btn';
      removeBtn.setAttribute('aria-label', `Remove ${file.name}`);

      const removeIcon = document.createElement('i');
      removeIcon.setAttribute('data-lucide', 'x');
      removeBtn.append(removeIcon);

      removeBtn.addEventListener('click', () => {
        files.splice(i, 1);
        renderFileList();
        updateButtonState();
      });

      item.append(nameSpan, sizeSpan, removeBtn);
      listWrapper.append(item);
    }

    fileListContainer.append(listWrapper);

    // --- Toggle button for large batches ---
    if (files.length > 20) {
      const toggleBtn = document.createElement('button');
      toggleBtn.className = 'file-summary__toggle';
      toggleBtn.textContent = 'Ver detalles';
      toggleBtn.addEventListener('click', () => {
        const hidden = listWrapper.hidden;
        listWrapper.hidden = !hidden;
        toggleBtn.textContent = hidden ? 'Ocultar detalles' : 'Ver detalles';
      });
      fileListContainer.append(toggleBtn);
    }

    // Trigger Lucide icon replacement for remove buttons.
    if (typeof lucide !== 'undefined') {
      try { lucide.createIcons(); } catch (e) { console.warn('Lucide icons failed to render:', e); }
    }
  }

  /**
   * Enables or disables the Generate button based on current state.
   */
  function updateButtonState() {
    generateBtn.disabled = files.length === 0 || !fechaEmision;
  }

  return container;
}
