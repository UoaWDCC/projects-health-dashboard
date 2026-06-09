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
