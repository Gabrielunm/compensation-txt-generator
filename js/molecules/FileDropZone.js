/**
 * FileDropZone molecule component.
 *
 * A drag-and-drop zone with a hidden `<input type="file">` for PDF
 * selection. Supports three visual states (empty, dragging, has-files)
 * and validates file types, showing memory warnings for large batches.
 *
 * @module molecules/FileDropZone
 */

import { formatSize } from '../utils/format.js';

/** @const {number} Memory-warning threshold — number of files. */
const MEMORY_WARN_THRESHOLD = 200;

/**
 * Calculates total size of a file array in bytes.
 *
 * @param {File[]} files - List of files.
 * @returns {number} Total size in bytes.
 */
function totalBytes(files) {
  return files.reduce((sum, f) => sum + f.size, 0);
}

/**
 * Renders a drag-and-drop file upload zone with PDF validation.
 *
 * The component manages three visual states internally:
 * - **empty**: Dashed border, prompt text.
 * - **dragging**: Highlighted border while the user drags files over.
 * - **has-files**: Solid border showing file count and total size.
 *
 * When the user drops or selects files, only `.pdf` files are passed to
 * {@code onFilesSelected}. A warning tooltip appears for batches of
 * {@value MEMORY_WARN_THRESHOLD}+ files.
 *
 * @param {Object} props              - Component properties.
 * @param {Function} props.onFilesSelected
 *        Callback invoked with {@code File[]} when files are dropped or
 *        selected. Only PDF files are included.
 * @param {string}  [props.accept='.pdf'] - Accepted file extensions.
 * @param {boolean} [props.multiple=true]  - Whether multiple files may be
 *        selected at once.
 * @returns {HTMLElement} The drop-zone container element.
 *
 * @example
 *   const zone = FileDropZone({
 *     onFilesSelected: (files) => console.log(files.length + ' PDFs added'),
 *   });
 *   document.getElementById('upload').append(zone);
 */
export function FileDropZone({
  onFilesSelected,
  accept = '.pdf,.txt',
  multiple = true,
}) {
  const container = document.createElement('div');
  container.className = 'drop-zone';
  container.setAttribute('role', 'button');
  container.setAttribute('tabindex', '0');

  // --- Visual state elements ---

  const prompt = document.createElement('p');
  prompt.textContent = 'Arrastrá PDFs o TXT con códigos de barra';
  container.append(prompt);

  const hint = document.createElement('small');
  hint.textContent = `Solo archivos ${accept} — hasta 400 por lote`;
  container.append(hint);

  // File count / size summary (visible in has-files state).
  const summary = document.createElement('p');
  summary.className = 'drop-zone__summary';
  summary.hidden = true;
  container.append(summary);

  // Memory warning banner.
  const warning = document.createElement('div');
  warning.className = 'memory-warning';
  warning.hidden = true;
  warning.textContent =
    `Large batch detected (≥${MEMORY_WARN_THRESHOLD} files). ` +
    'Ensure a stable connection and sufficient memory.';
  container.append(warning);

  // --- Hidden file input — accepts PDF and TXT ---

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,.txt';
  fileInput.multiple = multiple;
  fileInput.hidden = true;
  container.append(fileInput);

  // --- State ---

  /** @type {File[]} */
  let currentFiles = [];

  /**
   * Updates the visual state of the drop zone.
   *
   * @param {'empty'|'dragging'|'has-files'} state - The new state.
   */
  function setState(state) {
    container.classList.remove('drop-zone--dragging', 'drop-zone--has-files');

    if (state === 'dragging') {
      container.classList.add('drop-zone--dragging');
      prompt.textContent = 'Soltá los archivos para agregarlos';
    } else if (state === 'has-files') {
      container.classList.add('drop-zone--has-files');
      prompt.textContent = 'Arrastrá más PDFs o TXT para agregar';
      const size = formatSize(totalBytes(currentFiles));
      summary.textContent = `${currentFiles.length} archivo(s) — ${size} total`;
      summary.hidden = false;

      warning.hidden = currentFiles.length < MEMORY_WARN_THRESHOLD;
    } else {
      // empty
      prompt.textContent = 'Arrastrá PDFs o TXT con códigos de barra';
      summary.hidden = true;
      warning.hidden = true;
    }
  }

  /**
   * Filters dropped/selected files to PDFs and TXTs, then emits them.
   *
   * @param {File[]} rawFiles - The files from the drop or input event.
   */
  function addFiles(rawFiles) {
    const validFiles = rawFiles.filter(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf') ||
            f.type === 'text/plain' || f.name.toLowerCase().endsWith('.txt'),
    );
    if (validFiles.length === 0) {
      return;
    }

    currentFiles = currentFiles.concat(validFiles);
    onFilesSelected(validFiles);

    setState(currentFiles.length > 0 ? 'has-files' : 'empty');
  }

  // --- Event handlers ---

  container.addEventListener('click', () => {
    fileInput.click();
  });

  container.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInput.click();
    }
  });

  // Drag counter to track enter/leave across child elements.
  let dragCounter = 0;

  container.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    setState('dragging');
  });

  container.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  container.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      setState(currentFiles.length > 0 ? 'has-files' : 'empty');
    }
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0; // Reset counter to prevent drift from missed dragleave events.
    const rawFiles = Array.from(e.dataTransfer.files);
    addFiles(rawFiles);
  });

  // File input change.
  fileInput.addEventListener('change', () => {
    const rawFiles = Array.from(fileInput.files);
    addFiles(rawFiles);
    // Reset so re-selecting the same file(s) triggers change again.
    fileInput.value = '';
  });

  // Start in empty state.
  setState('empty');

  return container;
}
