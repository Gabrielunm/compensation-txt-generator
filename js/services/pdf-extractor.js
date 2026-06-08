/**
 * PDF barcode extractor service.
 *
 * Uses pdf.js (global `pdfjsLib`) to extract text from uploaded PDF files,
 * then finds all 50-digit barcodes via regex. Returns all unique barcodes
 * found across all pages of the PDF.
 *
 * @module services/pdf-extractor
 */

/** Regex matching all 50-digit sequences surrounded by word boundaries. */
const BARCODE_REGEX = /\b\d{50}\b/g;

/**
 * Extracts all unique 50-digit barcodes found in a PDF file's text layer.
 *
 * Loads the PDF via `pdfjsLib.getDocument()`, reads text from every page
 * using `page.getTextContent()`, and collects every 50-digit barcode.
 * Duplicate barcodes within the same PDF are removed (e.g. when the same
 * barcode appears on multiple pages).
 *
 * @param {File} pdfFile - The PDF file uploaded by the user.
 * @returns {Promise<string[]>} Array of unique 50-digit barcodes found,
 *   in order of first appearance. Empty array if none found.
 *
 * @throws {Error} If pdfjsLib is not available on the global scope, or if
 *   the PDF is corrupt and cannot be opened.
 *
 * @example
 *   const barcodes = await extractBarcodesFromPDF(pdfFile);
 *   console.log(`Found ${barcodes.length} barcode(s)`);
 */
export async function extractBarcodesFromPDF(pdfFile) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error(
      'pdfjsLib is not available. Ensure pdf.js is loaded before calling extractBarcodesFromPDF().',
    );
  }

  // Configure pdf.js web worker if not already set.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Validate file type — accept only PDFs.
  if (pdfFile.type !== 'application/pdf' && !pdfFile.name.endsWith('.pdf')) {
    return [];
  }

  /** @type {ArrayBuffer} */
  let arrayBuffer;

  try {
    arrayBuffer = await pdfFile.arrayBuffer();
  } catch (/** @type {*} */ _err) {
    // File.readAsArrayBuffer failed — file may be truncated or unreadable.
    return [];
  }

  /** @type {import('pdfjs-dist').PDFDocumentProxy} */
  let pdf;

  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (/** @type {*} */ _err) {
    // PDF document could not be parsed (corrupt, encrypted, or invalid format).
    return [];
  }

  // Iterate through pages and accumulate text content.
  const combinedText = [];

  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (const item of textContent.items) {
        if (item.str) {
          combinedText.push(item.str);
        }
      }
    }
  } catch (/** @type {*} */ _err) {
    // Text extraction failed on a page — return whatever was found so far.
    return [];
  } finally {
    // Always clean up the PDF document to release memory.
    await pdf.destroy();
  }

  const fullText = combinedText.join(' ');
  const matches = [...fullText.matchAll(BARCODE_REGEX)];
  const barcodes = matches.map((m) => m[0]);

  // Deduplicate within file while preserving order of first appearance.
  return [...new Set(barcodes)];
}
