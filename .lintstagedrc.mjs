// lint-staged runs on every git commit for staged files only.
// Prettier is applied globally; ESLint is scoped per workspace package so that
// each package's own eslint.config.mjs is picked up (ESLint 9 flat config
// resolves the config file relative to the cwd it is invoked from).

const PACKAGES = [
  { dir: 'apps/web', filter: 'web' },
  { dir: 'apps/worker', filter: 'worker' },
  { dir: 'packages/db', filter: '@repo/db' },
  { dir: 'packages/github', filter: '@repo/github' },
]

export default {
  '**/*.{ts,tsx,js,jsx,json,md,yaml,yml}': 'prettier --write',

  '**/*.{ts,tsx,js,mjs}': (filePaths) => {
    // Group staged files by which workspace package they belong to
    const groups = new Map()

    for (const fp of filePaths) {
      // Normalise Windows backslashes so the path check works on all platforms
      const normalized = fp.replace(/\\/g, '/')
      const pkg = PACKAGES.find((p) => normalized.includes(`/${p.dir}/`))
      if (!pkg) continue

      if (!groups.has(pkg)) groups.set(pkg, [])
      groups.get(pkg).push(fp)
    }

    // Emit one eslint command per package, run from that package's directory
    // so ESLint 9 flat config discovery finds the right eslint.config.mjs
    return [...groups.entries()].map(([pkg, files]) => {
      return `pnpm --filter ${pkg.filter} exec eslint --max-warnings=0 ${files.join(' ')}`
    })
  },
}
