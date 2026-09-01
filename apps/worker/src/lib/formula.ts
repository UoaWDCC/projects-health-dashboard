// Shared mathjs-based formula evaluation, used by health-score and MVP scoring —
// both read a formula string from Config (scope="GLOBAL") and evaluate it against
// weekly commit/PR/line/message counts.

import { db } from '@repo/db'

// Dynamic import avoids a static `require('mathjs')` under this project's CJS/node16
// module resolution — mathjs is ESM-only. Mirrors the same workaround already used
// for octokit in packages/github/src/index.ts.
type MathInstance = ReturnType<
  typeof import('mathjs', { with: { 'resolution-mode': 'import' } }).create
>

let mathInstance: MathInstance | null = null

async function getMath(): Promise<MathInstance> {
  if (!mathInstance) {
    const { create, all } = await import('mathjs')
    mathInstance = create(all)
  }
  return mathInstance
}

const GLOBAL_SCOPE = 'GLOBAL'

export type WeeklyStatsCounts = {
  commits: number
  prsMerged: number
  linesAdded: number
  linesRemoved: number
  discordMessages: number
}

export function buildFormulaScope(counts: WeeklyStatsCounts): Record<string, number> {
  return {
    commits: counts.commits,
    prs: counts.prsMerged,
    lines_changed: counts.linesAdded + counts.linesRemoved,
    discord_messages: counts.discordMessages,
  }
}

export async function evaluateFormula(
  formula: string,
  scope: Record<string, number>
): Promise<number | null> {
  try {
    const math = await getMath()
    const result = math.compile(formula).evaluate(scope)
    return typeof result === 'number' && Number.isFinite(result) ? result : null
  } catch {
    return null
  }
}

export async function getFormula(key: string): Promise<string | null> {
  const config = await db.config.findUnique({
    where: { scope_key: { scope: GLOBAL_SCOPE, key } },
  })
  return typeof config?.value === 'string' ? config.value : null
}
