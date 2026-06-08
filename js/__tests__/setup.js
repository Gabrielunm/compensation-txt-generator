/**
 * Jest setup file.
 *
 * Provides browser globals needed by service modules:
 *   - `Zod`: Zod validation library (window.Zod in browser context).
 *
 * Service modules use these globals when loaded via CDN in the browser.
 * This setup ensures they are available in the Node.js test environment.
 */
import { z } from 'zod';

globalThis.Zod = z;
