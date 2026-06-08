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

  // --- File list ---
  const fileListContainer = document.createElement('div');
  fileListContainer.className = 'comp-upload-panel__file-list';
  fileListContainer.setAttribute('aria-live', 'polite');
  container.append(fileListContainer);

  // --- Date picker ---
  const dateField = DatePickerField({
    label: 'Fecha de Emisión',
    onChange: (date) => {
      fechaEmision = date;
      updateButtonState();
    },
  });
  container.append(dateField);

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
      renderFileList();
      updateButtonState();
    },
  });
  container.append(clearBtn);

  // --- Generate handler ---
  generateBtn.addEventListener('click', () => {
    if (files.length > 0 && fechaEmision) {
      onProcess(files, fechaEmision);
    }
  });

  /**
   * Renders the file list with remove buttons for each file.
   */
  function renderFileList() {
    fileListContainer.textContent = '';

    if (files.length === 0) {
      return;
    }

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
      fileListContainer.append(item);
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
