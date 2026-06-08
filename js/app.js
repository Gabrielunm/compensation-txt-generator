/**
 * Compensation TXT Generator — Application entry point.
 *
 * Orchestrates the application state machine and composes all UI components.
 * Manages transitions between idle → processing → ready | error → idle.
 *
 * State machine:
 *   idle → (on upload & process) → processing → (on complete) → ready | error
 *   ready/error → (on clear) → idle
 *
 * @module app
 */

import { UploadPanel } from './organisms/UploadPanel.js';
import { ProcessingQueue } from './organisms/ProcessingQueue.js';
import { ResultsTable } from './organisms/ResultsTable.js';
import { CompensationReport } from './organisms/CompensationReport.js';
import { Button } from './atoms/Button.js';
import { CONFIG } from './config.js';
import { THEME } from './theme.js';

/**
 * @typedef {Object} AppState
 * @property {File[]} files — Uploaded PDF files.
 * @property {string} fechaEmision — User-selected date in YYYY-MM-DD format.
 * @property {import('./organisms/ProcessingQueue.js').ParsedRecord[]} records
 *   — Successfully processed records.
 * @property {import('./organisms/ProcessingQueue.js').ProcessError[]} errors
 *   — Files that failed processing.
 * @property {'idle'|'processing'|'ready'|'error'} status — Current state machine
 *   position.
 */

/** @type {AppState} */
const state = {
  files: [],
  fechaEmision: '',
  records: [],
  errors: [],
  status: 'idle',
};

/** @type {HTMLElement|null} */
let appRoot = null;

/** @type {import('driver.js').Driver|null} */
let activeTour = null;

// ===================================================================
//  Bootstrap
// ===================================================================

/**
 * Waits for DOM content, then mounts the application.
 *
 * CDN dependencies (Lucide, Zod, pdf.js) are loaded synchronously in the HTML
 * before this module, so their globals are guaranteed available.
 */
function mountApp() {
  appRoot = document.getElementById('app');

  if (!appRoot) {
    console.error('Compensation TXT Generator: <div id="app"> not found.');
    return;
  }

  render();

  // Wire the help/tour button in the header.
  const helpBtn = document.getElementById('btn-help-tour');
  if (helpBtn) {
    helpBtn.addEventListener('click', () => {
      // Destroy any active tour before starting a new one.
      if (activeTour) {
        try { activeTour.destroy(); } catch (_) { /* ignore */ }
      }
      if (state.status === 'idle') {
        activeTour = initUploadTour();
      } else {
        activeTour = initResultsTour(state.records.length, state.errors.length);
      }
      if (activeTour) {
        activeTour.drive();
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

// ===================================================================
//  Tour & Tooltips
// ===================================================================

/**
 * Initializes the Driver.js product tour for the UploadPanel (idle state).
 *
 * The tour helps new users understand how to upload PDFs, select a date,
 * and generate the compensation file.
 */
function initUploadTour() {
  /* global driver */
  if (typeof driver === 'undefined') {
    console.warn('Driver.js not loaded — tour unavailable.');
    return;
  }

  const driverObj = window.driver.js.driver({
    showProgress: true,
    animate: true,
    steps: [
      {
        element: '#step-header',
        popover: {
          title: 'Generador TXT de Compensación',
          description: `¡Bienvenido! Esta herramienta genera archivos TXT de compensación RAFAMR01 a partir de facturas PDF de ${THEME.name}. Todo se procesa localmente en tu navegador.`,
          side: 'bottom',
        },
      },
      {
        element: '.comp-upload-panel',
        popover: {
          title: 'Subir PDFs',
          description: 'Arrastrá tus facturas PDF Tipo 7 aquí, o hacé clic para buscarlas. Podés subir hasta 400 archivos por lote.',
          side: 'bottom',
        },
      },
      {
        element: '.comp-date-field',
        popover: {
          title: 'Fecha de Pago',
          description: 'Seleccioná la fecha de pago para este lote. Por defecto es hoy. La fecha se escribe en el campo RAFAM F31 (Fecha Pago).',
          side: 'bottom',
        },
      },
      {
        element: '.comp-upload-panel .comp-btn',
        popover: {
          title: 'Generar TXT',
          description: 'Hacé clic para comenzar. Cada PDF se extrae, valida y convierte en un registro RAFAMR01 de 279 caracteres.',
          side: 'top',
        },
      },
    ],
  });

  return driverObj;
}

/**
 * Initializes the Driver.js tour for the results (ready/error state).
 *
 * @param {number} validCount - Number of successfully processed records.
 * @param {number} errorCount - Number of failed records.
 * @returns {import('driver.js').Driver|undefined}
 */
function initResultsTour(validCount, errorCount) {
  /* global driver */
  if (typeof driver === 'undefined') {
    return undefined;
  }

  const steps = [
    {
      element: '.comp-results-table',
      popover: {
        title: 'Tabla de Resultados',
        description: 'Cada registro procesado se muestra aquí. Las columnas se pueden ordenar. Hacé clic en una fila para ver el código de barra completo.',
        side: 'top',
      },
    },
    {
      element: '.comp-report',
      popover: {
        title: 'Informe de Compensación',
        description: `Resumen: ${validCount} válido(s), ${errorCount} error(es). Descargá el archivo TXT o revisá los errores abajo.`,
        side: 'top',
      },
    },
  ];

  if (errorCount > 0) {
    steps.push({
      element: '.comp-report__errors',
      popover: {
        title: 'Errores',
        description: 'Archivos que no pudieron procesarse. Podés continuar sin los errores o cancelar el lote.',
        side: 'top',
      },
    });
  }

  const driverObj = window.driver.js.driver({
    showProgress: true,
    animate: true,
    steps,
  });

  return driverObj;
}

// ===================================================================
//  Rendering
// ===================================================================

/**
 * Clears the app root and re-renders all components for the current state.
 */
function render() {
  if (!appRoot) {
    return;
  }

  appRoot.textContent = '';

  switch (state.status) {
    case 'idle':
      renderUploadPanel();
      break;

    case 'processing':
      renderProcessingQueue();
      break;

    case 'ready':
    case 'error':
      renderResults();
      break;

    default: {
      const msg = `Compensation TXT Generator: unknown state "${state.status}".`;
      console.warn(msg);
      const err = document.createElement('p');
      err.textContent = msg;
      appRoot.append(err);
    }
  }
}

// ===================================================================
//  State renderers
// ===================================================================

/**
 * Renders the upload panel for the {@code idle} state.
 *
 * Creates an UploadPanel organism wired to transition to the processing
 * state when the user triggers {@code onProcess}.
 */
function renderUploadPanel() {
  const panel = UploadPanel({
    onProcess: (/** @type {File[]} */ files, /** @type {string} */ fecha) => {
      state.files = files;
      state.fechaEmision = fecha;
      state.status = 'processing';
      render();
    },
  });

  appRoot.append(panel);

  // Render Lucide icons for the newly mounted UploadPanel elements.
  if (typeof lucide !== 'undefined') {
    try { lucide.createIcons(); } catch (e) { console.warn('Lucide icons failed to render:', e); }
  }
}

/**
 * Renders the processing queue for the {@code processing} state.
 *
 * Creates a ProcessingQueue organism that processes all files sequentially.
 * The {@code onComplete} callback transitions the state to either {@code ready}
 * (when at least one record is valid) or {@code error} (when all files failed).
 */
function renderProcessingQueue() {
  const queue = ProcessingQueue({
    files: state.files,
    fechaEmision: state.fechaEmision,
    expectedEnte: CONFIG.entity.code,
    onComplete: (/** @type {{ valid: import('./organisms/ProcessingQueue.js').ParsedRecord[], errors: import('./organisms/ProcessingQueue.js').ProcessError[] }} */ result) => {
      state.records = result.valid;
      state.errors = result.errors;
      state.status = result.valid.length > 0 ? 'ready' : 'error';
      render();
    },
  });

  appRoot.append(queue);
}

/**
 * Renders the results view — summary card + collapsible table + report.
 *
 * For large batches, the individual record table starts collapsed to avoid
 * saturating the UI. A summary card shows total count, total amount, and
 * errors at a glance.
 */
function renderResults() {
  // --- Summary card ---
  const totalCents = state.records.reduce((s, r) => s + r.fields.importe1, 0);
  const summaryCard = document.createElement('div');
  summaryCard.className = 'results-summary';
  summaryCard.innerHTML = `
    <div class="results-summary__stat">
      <span class="results-summary__value">${state.records.length}</span>
      <span class="results-summary__label">comprobantes</span>
    </div>
    <div class="results-summary__stat">
      <span class="results-summary__value">${(totalCents / 100).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
      <span class="results-summary__label">total importe</span>
    </div>
    <div class="results-summary__stat ${state.errors.length > 0 ? 'results-summary__stat--error' : ''}">
      <span class="results-summary__value">${state.errors.length}</span>
      <span class="results-summary__label">errores</span>
    </div>
  `;
  appRoot.append(summaryCard);

  // --- Results table (collapsible if > 20 records) ---
  const showCollapsed = state.records.length > 20;
  const tableSection = document.createElement('div');
  tableSection.className = 'results-table-section';

  if (showCollapsed) {
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'results-table-toggle';
    toggleBtn.textContent = `Mostrar detalle (${state.records.length} registros)`;
    toggleBtn.addEventListener('click', () => {
      const hidden = tableBody.hidden;
      tableBody.hidden = !hidden;
      toggleBtn.textContent = hidden
        ? `Ocultar detalle (${state.records.length} registros)`
        : `Mostrar detalle (${state.records.length} registros)`;
    });
    tableSection.append(toggleBtn);
  }

  const tableBody = document.createElement('div');
  tableBody.hidden = showCollapsed;

  const table = ResultsTable({ records: state.records });
  tableBody.append(table);
  tableSection.append(tableBody);
  appRoot.append(tableSection);

  // --- Compensation report ---
  const report = CompensationReport({
    records: state.records,
    errors: state.errors,
    files: state.files,
    fechaEmision: state.fechaEmision,
    onCancel: resetToIdle,
    ...(state.records.length > 0 ? {
      onContinue: () => {
        state.status = 'ready';
        render();
      },
    } : {}),
  });
  appRoot.append(report);

  // --- Clear & Start Over button ---
  const clearBtn = Button({
    label: 'Limpiar y empezar de nuevo',
    variant: 'outline',
    icon: 'refresh-cw',
    onClick: resetToIdle,
  });
  appRoot.append(clearBtn);

  // Render Lucide icons.
  if (typeof lucide !== 'undefined') {
    try { lucide.createIcons(); } catch (e) { console.warn('Lucide icons failed to render:', e); }
  }
}

/**
 * Resets the application state to {@code idle} and re-renders.
 */
function resetToIdle() {
  state.files = [];
  state.fechaEmision = '';
  state.records = [];
  state.errors = [];
  state.status = 'idle';
  render();
}
