/** Tailwind só aponta para os tokens de src/styles/tokens.css. */
const c = (v) => `rgb(var(--${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      // breakpoints do workspace (spec §3): 1 coluna ≤899, 2 painéis 900–1279, 3 painéis ≥1280
      screens: { ws2: '900px', ws3: '1280px' },
      colors: {
        bg: c('background'),
        surface: c('surface'),
        raised: c('surface-raised'),
        sunken: c('surface-sunken'),
        line: c('border'),
        'line-strong': c('border-strong'),
        ink: c('text-primary'),
        muted: c('text-secondary'),
        inverse: c('text-inverse'),
        primary: { DEFAULT: c('primary'), hover: c('primary-hover'), soft: c('primary-soft') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        warning: { DEFAULT: c('warning'), soft: c('warning-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        focus: c('focus'),
        sidebar: { DEFAULT: c('sidebar'), text: c('sidebar-text'), active: c('sidebar-active') },
      },
      borderRadius: { sm: 'var(--radius-sm)', DEFAULT: 'var(--radius-md)', md: 'var(--radius-md)', lg: 'var(--radius-lg)' },
      boxShadow: { overlay: 'var(--shadow-overlay)' },
      fontFamily: { sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'] },
      fontSize: {
        xs: ['0.75rem', '1rem'],
        sm: ['0.8125rem', '1.25rem'],
        base: ['0.875rem', '1.375rem'],
        md: ['1rem', '1.5rem'],
        lg: ['1.125rem', '1.625rem'],
        xl: ['1.375rem', '1.875rem'],
        '2xl': ['1.75rem', '2.25rem'],
      },
    },
  },
  plugins: [],
};
