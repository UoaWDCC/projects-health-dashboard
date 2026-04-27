import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/**/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        brand: {
          // Light colours
          'blue-light': '#CFE0FD',
          'purple-light': '#E9CFCC',
          'peach-light': '#FDE6CF',
          'mint-light': '#D4F7ED',

          // Dark colours
          blue: '#077CF1',
          orange: '#FFB05F',
          pink: '#E333A3',
          navy: '#1F2031',
          slate: '#5A5E7A',
        },
      },
    },
  },
  plugins: [],
}

export default config
