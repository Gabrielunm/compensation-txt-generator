/**
 * Jest configuration for Compensation TXT Generator.
 *
 * @type {import('jest').Config}
 */
const config = {
  // Use `node` environment (no DOM needed for pure service tests).
  testEnvironment: 'node',

  // ESM support — disable transform so Jest passes modules through as-is.
  transform: {},

  // Only test pure service files (skip pdf-extractor — requires browser).
  testMatch: ['**/__tests__/**/*.test.js'],

  // Exclude fixtures directory.
  testPathIgnorePatterns: ['/node_modules/', '/fixtures/'],
};

export default config;
