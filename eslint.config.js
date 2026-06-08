/**
 * ESLint flat configuration.
 *
 * @module eslint.config
 */

import globals from 'globals';

export default [
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser and Jest environment.
        ...globals.browser,
        ...globals.jest,

        // CDN-loaded globals (read-only).
        Zod: 'readonly',
        lucide: 'readonly',
        pdfjsLib: 'readonly',
        driver: 'readonly',
        JSZip: 'readonly',
        XLSX: 'readonly',
      },
    },
    rules: {
      'no-var': 'error',
      'prefer-const': 'error',
      strict: 'error',
      'no-undef': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: 'error',
      curly: 'error',
      'no-eval': 'error',
    },
  },
];
