import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        elevated: 'var(--bg-elevated)',
        panel: 'var(--panel)',
        fg: 'var(--fg)',
        muted: 'var(--fg-muted)',
        faint: 'var(--fg-subtle)',
        gold: 'var(--gold)',
        cyan: 'var(--cyan)',
        danger: 'var(--danger)',
      },
      fontFamily: {
        sans: ['var(--font-sans-next)', 'var(--font-thai-next)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display-next)', 'Georgia', 'serif'],
        mono: ['var(--font-mono-next)', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
