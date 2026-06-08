/**
 * PDF barcode extractor service.
 *
 * Uses pdf.js (global `pdfjsLib`) to extract text from uploaded PDF files,
 * then matches a 50-digit barcode via regex.
 *
 * @module services/pdf-extractor
 */

/** Regex matching a 50-digit sequence surrounded by word boundaries. */
const BARCODE_REGEX = /\b\d{50}\b/;

/**
 * Extracts the first 50-digit barcode found in a PDF file's text layer.
 *
 * Loads the PDF via `pdfjsLib.getDocument()`, reads text from every page
 * using `page.getTextContent()`, and searches for a 50-digit barcode.
 *
 * @param {File} pdfFile - The PDF file uploaded by the user.
 * @returns {Promise<string|null>} The first 50-digit barcode found, or
 *   {@code null} if no barcode is found or the PDF cannot be read.
 *
 * @throws {Error} If pdfjsLib is not available on the global scope, or if
 *   the PDF is corrupt and cannot be opened.
 *
 * @example
 *   const barcode = await extractBarcodeFromPDF(pdfFile);
 *   if (barcode) {
 *     console.log('Found:', barcode);
 *   }
 */
export async function extractBarcodeFromPDF(pdfFile) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error(
      'pdfjsLib is not available. Ensure pdf.js is loaded before calling extractBarcodeFromPDF().',
    );
  }

  // Configure pdf.js web worker if not already set.
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }

  // Validate file type — accept only PDFs.
  if (pdfFile.type !== 'application/pdf' && !pdfFile.name.endsWith('.pdf')) {
    return null;
  }

  /** @type {ArrayBuffer} */
  let arrayBuffer;

  try {
    arrayBuffer = await pdfFile.arrayBuffer();
    } catch (/** @type {*} */ _err) {
    // File.readAsArrayBuffer failed — file may be truncated or unreadable.
    return null;
  }

  /** @type {import('pdfjs-dist').PDFDocumentProxy} */
  let pdf;

  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    } catch (/** @type {*} */ _err) {
    // PDF document could not be parsed (corrupt, encrypted, or invalid format).
    return null;
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
    return null;
  } finally {
    // Always clean up the PDF document to release memory.
    await pdf.destroy();
  }

  const fullText = combinedText.join(' ');
  const match = fullText.match(BARCODE_REGEX);

  if (match) {
    return match[0];
  }

  // No 50-digit barcode found in the text layer.
  return null;
}
