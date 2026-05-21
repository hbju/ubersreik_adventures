/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
    // Scan shared package so Tailwind classes used by @wfrp/shared components resolve in this app
    '../shared/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Background tiers
        'bg-deepest': 'var(--bg-deepest)',
        'bg-dark': 'var(--bg-dark)',
        'bg-panel': 'var(--bg-panel)',
        'bg-elevated': 'var(--bg-elevated)',
        'bg-surface': 'var(--bg-surface)',
        // Parchment
        parchment: {
          DEFAULT: 'var(--parchment)',
          dark: 'var(--parchment-dark)',
          light: 'var(--parchment-light)',
        },
        // Metals
        brass: {
          DEFAULT: 'var(--brass)',
          light: 'var(--brass-light)',
          dark: 'var(--brass-dark)',
        },
        iron: {
          DEFAULT: 'var(--iron)',
          dark: 'var(--iron-dark)',
        },
        copper: {
          DEFAULT: 'var(--copper)',
          light: 'var(--copper-light)',
        },
        // Functional
        blood: {
          DEFAULT: 'var(--blood)',
          light: 'var(--blood-light)',
        },
        poison: {
          DEFAULT: 'var(--poison)',
          light: 'var(--poison-light)',
        },
        magic: {
          DEFAULT: 'var(--magic)',
          light: 'var(--magic-light)',
        },
        fate: {
          DEFAULT: 'var(--fate)',
          light: 'var(--fate-light)',
        },
        // Status
        success: 'var(--status-success)',
        danger: 'var(--status-danger)',
        warning: 'var(--status-warning)',
        info: 'var(--status-info)',
      },
      textColor: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        accent: 'var(--text-accent)',
        muted: 'var(--text-muted)',
        'on-brass': 'var(--text-on-brass)',
      },
      borderColor: {
        dark: 'var(--border-dark)',
        subtle: 'var(--border-subtle)',
        brass: 'var(--border-brass)',
        'brass-solid': 'var(--border-brass-solid)',
      },
      fontFamily: {
        display: ['Cinzel', 'Cinzel Decorative', 'Georgia', 'serif'],
        body: ['Crimson Text', 'Georgia', 'serif'],
      },
      boxShadow: {
        inset: 'var(--shadow-inset)',
        elevated: 'var(--shadow-elevated)',
        deep: 'var(--shadow-deep)',
        'glow-brass': 'var(--shadow-glow-brass)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
      },
    },
  },
  corePlugins: {
    preflight: false,
  },
  plugins: [],
}
