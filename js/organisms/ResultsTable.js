/**
 * ResultsTable organism component.
 *
 * Renders a sortable, responsive table of processed records using
 * Pico CSS table styling. Each row displays extracted fields with a
 * status badge. Columns are clickable to sort ascending/descending.
 * Rows can be expanded to reveal the full barcode.
 *
 * @module organisms/ResultsTable
 */

import { Badge } from '../atoms/Badge.js';
import { formatImporte } from '../utils/format.js';

/**
 * Sort direction constants.
 *
 * @enum {string}
 */
const SortDir = {
  ASC: 'asc',
  DESC: 'desc',
};

/**
 * Truncates a barcode for display, keeping first 10 and last 10 digits.
 *
 * @param {string} barcode - Full 50-digit barcode.
 * @returns {string} Truncated representation.
 */
function truncateBarcode(barcode) {
  if (barcode.length <= 20) {
    return barcode;
  }
  return `${barcode.slice(0, 10)}...${barcode.slice(-10)}`;
}

/**
 * Extracts the nro_inmueble from a file name.
 * Convention: the numeric prefix before the first underscore.
 *
 * @param {string} fileName - e.g. `"142883_100_7.pdf"`.
 * @returns {string} e.g. `"142883"`.
 */
function extractInmueble(fileName) {
  const match = fileName.match(/^(\d+)/);
  return match ? match[1] : fileName;
}

/**
 * Renders a sortable results table from processed records.
 *
 * Columns (sortable by clicking the header):
 * - Nro Inmueble (from file name)
 * - Comprobante (nroComprobante from parsed fields)
 * - Tipo (tipoComprobante)
 * - Importe (formatted as $X.XX)
 * - Barcode (truncated, click row to expand/collapse)
 * - Status (badge)
 *
 * @param {Object} props                 - Component properties.
 * @param {Array<import('./ProcessingQueue.js').ParsedRecord>} props.records
 *        Array of successfully processed records.
 * @returns {HTMLElement} A section containing the table (or empty state).
 *
 * @example
 *   const table = ResultsTable({ records: parsedRecords });
 *   document.getElementById('results').append(table);
 */
export function ResultsTable({ records }) {
  const container = document.createElement('div');
  container.className = 'comp-results-table';

  // --- Empty state ---
  if (!records || records.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'comp-results-table__empty';
    empty.textContent = 'No hay registros para mostrar';
    container.append(empty);
    return container;
  }

  // --- Sort state ---
  /** @type {{ col: string|null, dir: string }} */
  const sortState = { col: null, dir: SortDir.ASC };
  /** @type {Array<import('./ProcessingQueue.js').ParsedRecord>} */
  let sortedRecords = [...records];

  // --- Build table ---
  const wrapper = document.createElement('div');
  wrapper.className = 'table-wrapper';

  const table = document.createElement('table');
  table.className = 'comp-results-table__table';

  // --- Thead ---
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  const columns = [
    { key: 'inmueble', label: 'Nro Inmueble' },
    { key: 'comprobante', label: 'Comprobante' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'importe', label: 'Importe' },
    { key: 'barcode', label: 'Barcode' },
    { key: 'status', label: 'Status' },
  ];

  for (const col of columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    th.setAttribute('data-sort-key', col.key);
    th.setAttribute('role', 'columnheader');
    th.style.cursor = 'pointer';
    th.tabIndex = 0;

    // Sort indicator arrow.
    const arrow = document.createElement('span');
    arrow.className = 'comp-results-table__sort-arrow';
    arrow.textContent = ' ';
    th.append(arrow);

    th.addEventListener('click', () => toggleSort(col.key));
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSort(col.key);
      }
    });

    headerRow.append(th);
  }

  thead.append(headerRow);
  table.append(thead);

  // --- Tbody (will be re-rendered on sort) ---

  /** @type {HTMLTableSectionElement} */
  const tbody = document.createElement('tbody');
  table.append(tbody);

  /**
   * Compares two records by a column key for sorting.
   *
   * @param {import('./ProcessingQueue.js').ParsedRecord} a
   * @param {import('./ProcessingQueue.js').ParsedRecord} b
   * @param {string} colKey - Column key to sort by.
   * @returns {number} -1, 0, or 1.
   */
  function compareBy(a, b, colKey) {
    const getVal = (rec) => {
      switch (colKey) {
        case 'inmueble': return extractInmueble(rec.fileName);
        case 'comprobante': return rec.fields.nroComprobante;
        case 'tipo': return rec.fields.tipoComprobante;
        case 'importe': return rec.fields.importe1;
        case 'barcode': return rec.barcode;
        case 'status': return 'valid';
        default: return '';
      }
    };

    const va = getVal(a);
    const vb = getVal(b);

    if (typeof va === 'number' && typeof vb === 'number') {
      return va - vb;
    }
    return String(va).localeCompare(String(vb), 'en', { numeric: true });
  }

  /**
   * Sorts the records by the given column key.
   *
   * @param {string} colKey - Column key to sort by.
   */
  function toggleSort(colKey) {
    if (sortState.col === colKey) {
      sortState.dir = sortState.dir === SortDir.ASC ? SortDir.DESC : SortDir.ASC;
    } else {
      sortState.col = colKey;
      sortState.dir = SortDir.ASC;
    }

    sortedRecords = [...records].sort((a, b) => {
      const cmp = compareBy(a, b, sortState.col);
      return sortState.dir === SortDir.ASC ? cmp : -cmp;
    });

    renderBody();
  }

  /**
   * Renders the table body rows from sorted records.
   */
  function renderBody() {
    tbody.textContent = '';

    for (const rec of sortedRecords) {
      const row = document.createElement('tr');
      row.className = 'comp-results-table__row';
      row.style.cursor = 'pointer';

      // Inmueble
      const td1 = document.createElement('td');
      td1.textContent = extractInmueble(rec.fileName);
      row.append(td1);

      // Comprobante
      const td2 = document.createElement('td');
      td2.textContent = rec.fields.nroComprobante;
      row.append(td2);

      // Tipo
      const td3 = document.createElement('td');
      td3.textContent = rec.fields.tipoComprobante;
      row.append(td3);

      // Importe
      const td4 = document.createElement('td');
      td4.className = 'comp-results-table__importe';
      td4.textContent = formatImporte(rec.fields.importe1);
      row.append(td4);

      // Barcode (truncated)
      const td5 = document.createElement('td');
      td5.textContent = truncateBarcode(rec.barcode);
      td5.className = 'comp-results-table__barcode';
      row.append(td5);

      // Status badge
      const td6 = document.createElement('td');
      const badge = Badge({ text: 'Valid', variant: 'success' });
      td6.append(badge);
      row.append(td6);

      // Row click: expand/collapse full barcode in a details row.
      let expanded = false;
      row.addEventListener('click', () => {
        expanded = !expanded;
        // Remove any existing detail row for this row.
        const nextRow = row.nextElementSibling;
        if (nextRow && nextRow.classList.contains('comp-results-table__detail')) {
          nextRow.remove();
          return;
        }

        if (expanded) {
          const detailRow = document.createElement('tr');
          detailRow.className = 'comp-results-table__detail';

          const detailCell = document.createElement('td');
          detailCell.colSpan = 6;
          detailCell.className = 'comp-results-table__detail-cell';

          const code = document.createElement('code');
          code.textContent = `Full barcode: ${rec.barcode}`;
          detailCell.append(code);

          detailRow.append(detailCell);
          row.after(detailRow);
        }
      });

      tbody.append(row);
    }
  }

  renderBody();
  wrapper.append(table);
  container.append(wrapper);

  return container;
}
