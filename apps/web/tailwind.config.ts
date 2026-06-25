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
        leaderboard: {
          loc: {
            fill: '#E333A3',
            stroke: '#9F196E',
            lightFill: '#EBC9DF',
            lightStroke: '#EBA7D3',
          },
          commits: {
            fill: '#077CF1',
            stroke: '#1861AB',
            lightFill: '#99C8F7',
            lightStroke: '#61A3E5',
          },
          prs: {
            fill: '#F4900C',
            stroke: '#BA730C',
            lightFill: '#FFD9A7',
            lightStroke: '#FFBE69',
          },
        },
      },
    },
  },
  plugins: [],
}

export default config
