import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/**/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
        arial: ['Arial', 'sans-serif'],
        'cartograph-mono-cf': [
          'var(--font-cartograph-mono-cf)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
        figtree: ['var(--font-figtree)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        wdcc: {
          // Light colours
          purple: '#E9CFFC',
          peach: '#FDE6CF',
          mint: '#D4F7ED',

          // Dark colours
          blue: {
            light: '#CFE0FD',
            DEFAULT: '#077CF1',
          },
          orange: '#FFB05F',
          amber: '#FFAC33',
          kelvin: '#E333A3', // pink
          grey: {
            light: '#9A9EB8',
            DEFAULT: '#5A5E7A',
          },
          oshan: '#1F2031', // black
        },
      },
    },
  },
  plugins: [],
}

export default config
