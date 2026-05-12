/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--bg-primary)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        border: 'var(--border)',
        accent: {
          DEFAULT: 'var(--accent)',
          soft: 'var(--accent-soft)',
        },
        text: {
          primary: 'var(--text-primary)',
          muted: 'var(--text-muted)',
        },
        positive: 'var(--positive)',
        negative: 'var(--negative)',
        warning: 'var(--warning)',
      },
      fontFamily: {
        display: ['DM Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        card: 'var(--radius)',
      },
      maxWidth: {
        content: '1200px',
      },
      boxShadow: {
        card: '0 6px 24px -8px rgba(0,0,0,0.45)',
      },
    },
  },
  plugins: [],
};
