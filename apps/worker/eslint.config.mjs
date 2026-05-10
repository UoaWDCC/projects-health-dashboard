import { defineConfig } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  tseslint.configs.recommended,
  {
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: {
          allowDefaultProject: ['*.config.mjs', '*.config.ts', '*.integration.ts'],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
)