import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}', '../../packages/**/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
        arial: ['Arial', 'sans-serif'],
      },
      colors: {
        'wdcc-blue': {
          light: '#CFE0FD',
          DEFAULT: '#077CF1',
        },
        'wdcc-black': {
          DEFAULT: '#1F2031',
        },
      },
    },
  },
  plugins: [],
}

export default config
