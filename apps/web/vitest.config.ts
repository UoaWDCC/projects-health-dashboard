import { defineConfig } from 'vitest/config'
import path from 'path'

// Configured only for backend
export default defineConfig({
  // esbuild: {
  //   // Use the React 17+ automatic JSX runtime — no import needed in every file
  //   jsx: 'automatic',
  //   jsxImportSource: 'react',
  // },
  test: {
    globals: true,
    // jsdom simulates the browser DOM for component rendering tests
    // environment: 'jsdom',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', '.next', 'src/**/*.test.tsx'],
    setupFiles: ['./src/test-config/vitest.setup.ts'],
    passWithNoTests: true,
  },
  resolve: {
    // Mirror the @/* path alias from tsconfig.json so imports resolve correctly in tests
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
