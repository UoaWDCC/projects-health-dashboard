import { create, all } from 'mathjs'

export const math = create(all)

// #region Constants

export const FORMULA_VARIABLES = [
  {
    key: 'prs',
    label: 'Pull Requests',
    description: 'Total open/merged PRs this week',
    color: '#077CF1',
    bg: 'rgba(7,124,241,0.10)',
  },
  {
    key: 'lines_changed',
    label: 'Lines Changed',
    description: 'Lines added + removed across all commits',
    color: '#E333A3',
    bg: 'rgba(227,51,163,0.10)',
  },
  {
    key: 'discord_messages',
    label: 'Discord Messages',
    description: 'Messages sent in linked channels',
    color: '#5B8AF0',
    bg: 'rgba(91,138,240,0.10)',
  },
  {
    key: 'commits',
    label: 'Commits',
    description: 'Commits pushed this week',
    color: '#0FAAA0',
    bg: 'rgba(15,170,160,0.10)',
  },
] as const

const VALID_VARIABLE_KEYS = FORMULA_VARIABLES.map((v) => v.key)

// #endregion

type FormulaVariable = (typeof FORMULA_VARIABLES)[number]['key']

// #region Util functions for Zod schema

/**
 * Returns a sample scope with dummy values for all variables, used for validation and live preview.
 * In the future, we could fetch real data for the current project to make the preview more accurate.
 * @returns {Record<FormulaVariable, number>} An object mapping variable keys to sample numeric values
 */
export const getSampleScope = (): Record<FormulaVariable, number> => ({
  prs: 4,
  lines_changed: 320,
  discord_messages: 47,
  commits: 12,
})

/**
 * Extracts all identifiers from the formula and returns those that are not in the list of valid variables or math built-ins.
 * @param {string} val The formula string to analyse
 * @returns {string[]} An array of unknown identifier names found in the formula
 */
export const getUnknownIdentifiers = (val: string): string[] => {
  const identifiers = val.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
  const mathBuiltins = Object.keys(math)
  return identifiers.filter(
    (id) => !VALID_VARIABLE_KEYS.includes(id as FormulaVariable) && !mathBuiltins.includes(id)
  )
}

// #endregion

// #region Util functions for FormulaInput component

/**
 * Extracts all identifiers from the formula and returns those that are not in the list of valid variables or math built-ins.
 * @param {string} val The formula string to analyse
 * @param {string[]} mathBuiltins List of built-in function names from mathjs to exclude from unknown identifiers
 * @returns {string[]} An array of unknown identifier names found in the formula
 */
export function getActiveSuggestions(
  value: string,
  cursor: number
): {
  suggestions: (typeof FORMULA_VARIABLES)[number][]
  wordStart: number
  word: string
} {
  const before = value.slice(0, cursor)
  const match = before.match(/[a-zA-Z_][a-zA-Z0-9_]*$/)
  if (!match) return { suggestions: [], wordStart: cursor, word: '' }

  const word = match[0].toLowerCase()
  const wordStart = cursor - word.length
  const suggestions = FORMULA_VARIABLES.filter((v) => v.key.startsWith(word) && v.key !== word)

  return { suggestions, wordStart, word }
}

/**
 * Evaluates the formula with sample variable values to provide a live preview.
 * Returns either the computed result or an error message if evaluation fails.
 * @param {string} formula The formula string to evaluate
 * @returns {{ result: number | null; error: string | null }} An object containing either the numeric result or an error message
 */
export function evaluatePreview(formula: string): { result: number | null; error: string | null } {
  if (!formula.trim()) return { result: null, error: null }
  try {
    const scope = getSampleScope()
    const result = math.compile(formula).evaluate(scope)
    if (typeof result !== 'number' || !isFinite(result)) {
      return { result: null, error: 'Result is not a finite number' }
    }
    return { result, error: null }
  } catch (e) {
    return { result: null, error: String(e) }
  }
}

/**
 * Simple syntax highlighter for the formula input. Wraps known variables, numbers, and operators
 * @param {string} formula The raw formula string to highlight
 * @returns {string} HTML string with syntax highlighting applied
 */
export function highlightFormula(formula: string): string {
  // Tokenise the plain-text formula first, then wrap each token in a coloured span - avoids regex running over already-injected HTML tag characters.
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const varKeys = FORMULA_VARIABLES.map((v) => v.key)
  const varColorMap: Record<string, string> = Object.fromEntries(
    FORMULA_VARIABLES.map((v) => [v.key, v.color])
  )

  // Build tokeniser: known vars | numbers | operators | identifiers | whitespace | single-char fallback
  // IMPORTANT: fallback must NOT be \S+ as it greedily eats "sqrt(discord_messages)" as one token.
  // Instead use an identifier pattern so "sqrt" tokenises separately from the "(" that follows it.
  const tokenRe = new RegExp(
    [
      ...varKeys,
      String.raw`\d+(?:\.\d+)?`,
      String.raw`[+\-*/%^(),]`,
      String.raw`[a-zA-Z_][a-zA-Z0-9_]*`,
      String.raw`\s+`,
      String.raw`[\s\S]`,
    ].join('|'),
    'g'
  )

  const tokens = formula.match(tokenRe) ?? (formula ? [formula] : [])

  return tokens
    .map((tok) => {
      if (varColorMap[tok]) {
        return `<span style="color:${varColorMap[tok]};font-weight:600">${escape(tok)}</span>`
      }
      if (/^\d+(?:\.\d+)?$/.test(tok)) {
        return `<span style="color:#0FAAA0">${tok}</span>`
      }
      if (/^[+\-*/%^()]+$/.test(tok)) {
        return `<span style="color:#6b7280">${tok}</span>`
      }
      if (/^\s+$/.test(tok)) return tok
      // Unknown identifier - show dimly so it's visible but clearly wrong
      return `<span style="color:#6b7280">${escape(tok)}</span>`
    })
    .join('')
}

// #endregion
