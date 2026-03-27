import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

export default [
  // Ignore build output and Next.js auto-generated type file
  { ignores: ['.next/**', 'next-env.d.ts', 'eslint.config.mjs'] },
  // Next.js recommended rules: core web vitals + TypeScript
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]
