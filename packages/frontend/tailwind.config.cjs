/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // ---- Radius scale: 4 / 6 / 8 only. Anything larger is a bug. ----
      borderRadius: {
        DEFAULT: '3px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '8px',
        '2xl': '8px',
        full: '9999px',
      },
      // ---- Elevation: used only where hierarchy demands it ----
      boxShadow: {
        none: 'none',
        sm: '0 1px 2px 0 rgb(15 23 42 / 0.06)',
        DEFAULT: '0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.08)',
        md: '0 4px 12px -4px rgb(15 23 42 / 0.12)',
        lg: '0 12px 28px -8px rgb(15 23 42 / 0.18)',
        '2xl': '0 24px 48px -12px rgb(15 23 42 / 0.30)',
      },
      letterSpacing: {
        label: '0.09em',
        tight: '0.04em',
      },
    },
  },
  plugins: [],
};
