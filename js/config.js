/**
 * Application configuration.
 *
 * Central place for entity-specific and operational settings.
 * Entity branding (name, code, colors) lives in {@link theme.js} —
 * import from there for a single source of truth.
 *
 * @module config
 */

import { THEME } from './theme.js';

/**
 * Application-wide configuration object.
 *
 * @typedef {Object} AppConfig
 * @property {Object}   entity
 * @property {string}   entity.code       - Código de ente municipal (4 digits).
 * @property {string}   entity.name       - Display name for reports and UI.
 * @property {Object}   rafam
 * @property {string}   rafam.idCaptura   - RAFAMR01 fixed header.
 * @property {string}   rafam.operationCode - Default: A3 (Efectivo).
 * @property {string}   rafam.terminalCode  - Código Terminal (5 chars).
 * @property {string}   rafam.branchCode    - Código Sucursal (4 chars).
 */

/** @type {AppConfig} */
export const CONFIG = {
  /** Entity (municipality / company) settings — sourced from theme */
  entity: {
    code: THEME.code,   // from theme.js — change there for rebranding
    name: THEME.name,
  },

  /** RAFAMR01 operational defaults */
  rafam: {
    idCaptura: 'RAFAMR01',
    operationCode: 'A3',
    terminalCode: '00001',
    branchCode: '0001',
    codigoBCRA: '0000',
  },
};
