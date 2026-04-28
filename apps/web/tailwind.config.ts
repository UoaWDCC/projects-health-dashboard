import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/**/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        arial: ['Arial', 'sans-serif'],
        'courier-prime': ['var(--font-courier-prime)'],
        figtree: ['var(--font-figtree)'],
      },
      colors: {
        wdcc: {
          // Light colours
          purple: '#E9CFCC',
          peach: '#FDE6CF',
          mint: '#D4F7ED',

          // Dark colours
          blue: {
            light: '#CFE0FD',
            DEFAULT: '#077CF1',
          },
          orange: '#FFB05F',
          kelvin: '#E333A3', // pink (zesty kelvin)
          grey: {
            light: '#9A9EB8',
            DEFAULT: '#5A5E7A',
          },
          oshan: '#1F2031', // black (...)
        },
      },
    },
  },
  plugins: [],
}

export default config
