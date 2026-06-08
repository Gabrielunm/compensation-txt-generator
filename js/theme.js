/**
 * Brand theme configuration.
 *
 * Central place for brand colors, logo, and typography.
 * Change these values to rebrand the app for a different municipality
 * or entity without touching CSS or components.
 *
 * Colors extracted from the entity's official website.
 *
 * @module theme
 */

/**
 * Brand palette and assets.
 *
 * @typedef {Object} BrandTheme
 * @property {string}   name          - Entity display name.
 * @property {string}   code          - Entity code (4 digits).
 * @property {string}   logo          - Path to main logo (relative to index.html).
 * @property {string}   logoWhite     - Path to white/inverted logo.
 * @property {Object}   colors
 * @property {string}   colors.primary       - Primary brand color.
 * @property {string}   colors.primaryHover  - Primary hover state.
 * @property {string}   colors.accent        - Accent color (warnings, highlights).
 * @property {string}   colors.secondary     - Secondary brand color.
 * @property {string}   colors.dark          - Dark text/background.
 * @property {string}   colors.bg            - Page background.
 * @property {string}   colors.surface       - Card/surface background.
 * @property {string}   colors.text          - Body text color.
 * @property {string}   colors.textMuted     - Muted/secondary text.
 * @property {string}   colors.success       - Success green.
 * @property {string}   colors.error         - Error red.
 * @property {string}   colors.warning       - Warning amber.
 * @property {Object}   fonts
 * @property {string}   fonts.body           - Body font stack.
 * @property {string}   fonts.heading        - Heading font stack.
 */

/** @type {BrandTheme} */
export const THEME = {
  /** Entity display name — shown in header and reports */
  name: 'Hurlingham',

  /** Entity code (used for barcode validation) */
  code: '0135',

  /** Logo paths (relative to index.html) */
  logo: 'assets/logo.png',
  logoWhite: 'assets/logo-white.png',

  /** Brand color palette */
  colors: {
    // Primary: teal — extracted from --color-content-primary: #00ad9c
    primary: '#00ad9c',
    primaryHover: '#009688',

    // Accent: amber — extracted from --hul-naranja: #f6a300
    accent: '#f6a300',

    // Secondary: light blue — extracted from --hul-celeste: #00a8e8
    secondary: '#00a8e8',

    // Dark: near black — extracted from --color-header-top-bg: #231F20
    dark: '#231F20',

    // Backgrounds
    bg: '#f5f7fa',
    surface: '#ffffff',

    // Text
    text: '#50535c',
    textMuted: '#aaaaaa',

    // Semantic status colors
    success: '#2fb344',
    error: '#d63939',
    warning: '#f59f00',
  },

  /** Font stacks — DM Sans for distinctive, refined typography */
  fonts: {
    body: "'DM Sans', 'Segoe UI', system-ui, -apple-system, sans-serif",
    heading: "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  },
};
