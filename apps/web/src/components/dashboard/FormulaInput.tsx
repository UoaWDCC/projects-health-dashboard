'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { create, all } from 'mathjs'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// mathjs instance
// ---------------------------------------------------------------------------
const math = create(all)

// ---------------------------------------------------------------------------
// Variables
// ---------------------------------------------------------------------------
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

export type FormulaVariable = (typeof FORMULA_VARIABLES)[number]['key']

// ---------------------------------------------------------------------------
// Placeholder sample values (replace with real data fetching)
// ---------------------------------------------------------------------------
const getSampleScope = (): Record<FormulaVariable, number> => ({
  prs: 4, // TODO: fetch from GitHub API for this project
  lines_changed: 320, // TODO: fetch from GitHub commit stats
  discord_messages: 47, // TODO: fetch from Discord channel stats
  commits: 12, // TODO: fetch from GitHub commit count
})

// ---------------------------------------------------------------------------
// Zod schema
// ---------------------------------------------------------------------------
const VALID_VARIABLE_KEYS = FORMULA_VARIABLES.map((v) => v.key)

const getUnknownIdentifiers = (val: string): string[] => {
  const identifiers = val.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) ?? []
  const mathBuiltins = Object.keys(math)
  return identifiers.filter(
    (id) => !VALID_VARIABLE_KEYS.includes(id as FormulaVariable) && !mathBuiltins.includes(id)
  )
}

const formulaSchema = z
  .string()
  .min(1, 'Formula cannot be empty')
  .superRefine((val, ctx) => {
    const unknown = getUnknownIdentifiers(val)
    if (unknown.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
      })
    }
  })
  .refine(
    (val) => {
      try {
        const scope = getSampleScope()
        math.compile(val).evaluate(scope)
        return true
      } catch {
        return false
      }
    },
    { message: 'Formula has a syntax error' }
  )
  .refine(
    (val) => {
      try {
        const scope = getSampleScope()
        const result = math.compile(val).evaluate(scope)
        return typeof result === 'number' && isFinite(result)
      } catch {
        return false
      }
    },
    { message: 'Formula must evaluate to a finite number' }
  )

// ---------------------------------------------------------------------------
// Suggestion matching
// ---------------------------------------------------------------------------
function getActiveSuggestions(
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

// ---------------------------------------------------------------------------
// Preview evaluation
// ---------------------------------------------------------------------------
function evaluatePreview(formula: string): { result: number | null; error: string | null } {
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

// ---------------------------------------------------------------------------
// Highlighted formula display
// ---------------------------------------------------------------------------
function highlightFormula(formula: string): string {
  // Tokenise the plain-text formula first, then wrap each token in a coloured
  // span — avoids regex running over already-injected HTML tag characters.
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const varKeys = FORMULA_VARIABLES.map((v) => v.key)
  const varColorMap: Record<string, string> = Object.fromEntries(
    FORMULA_VARIABLES.map((v) => [v.key, v.color])
  )

  // Build tokeniser: known vars | numbers | operators | identifiers | whitespace | single-char fallback
  // IMPORTANT: fallback must NOT be \S+ — it greedily eats "sqrt(discord_messages)" as one token.
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
      // Unknown identifier — show dimly so it's visible but clearly wrong
      return `<span style="color:#6b7280">${escape(tok)}</span>`
    })
    .join('')
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
export interface FormulaInputProps {
  initialFormula?: string | null
  onSaveSuccess?: (formula: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function FormulaInput({ initialFormula = '', onSaveSuccess }: FormulaInputProps) {
  const [formula, setFormula] = useState(initialFormula ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [suggestions, setSuggestions] = useState<(typeof FORMULA_VARIABLES)[number][]>([])
  const [activeSuggIdx, setActiveSuggIdx] = useState(0)
  const [suggWordStart, setSuggWordStart] = useState(0)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const suggBoxRef = useRef<HTMLDivElement>(null)

  const preview = evaluatePreview(formula)

  // Sync overlay scroll with textarea scroll
  const syncScroll = useCallback(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  // Validate on change
  useEffect(() => {
    if (!formula.trim()) {
      setError(null)
      return
    }
    const result = formulaSchema.safeParse(formula)
    setError(result.success ? null : result.error.issues[0].message)
  }, [formula])

  // Handle input change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setFormula(val)
    setSaved(false)

    const cursor = e.target.selectionStart ?? val.length
    const { suggestions: sugg, wordStart } = getActiveSuggestions(val, cursor)
    setSuggestions(sugg)
    setSuggWordStart(wordStart)
    setActiveSuggIdx(0)
  }

  // Apply a suggestion
  const applySuggestion = (varKey: string) => {
    const cursor = textareaRef.current?.selectionStart ?? formula.length
    const word = formula.slice(suggWordStart, cursor)
    const before = formula.slice(0, suggWordStart)
    const after = formula.slice(suggWordStart + word.length)
    const newFormula = before + varKey + after
    setFormula(newFormula)
    setSuggestions([])

    // Place cursor after inserted variable
    setTimeout(() => {
      const pos = suggWordStart + varKey.length
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

  // Keyboard handling
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestions.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveSuggIdx((i) => (i + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveSuggIdx((i) => (i - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applySuggestion(suggestions[activeSuggIdx].key)
    } else if (e.key === 'Escape') {
      setSuggestions([])
    }
  }

  // Insert variable chip from the reference panel
  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current
    const cursor = ta?.selectionStart ?? formula.length
    const before = formula.slice(0, cursor)
    const after = formula.slice(cursor)
    const separator = before.length > 0 && !/[\s(]$/.test(before) ? ' ' : ''
    const newFormula = before + separator + varKey + after
    setFormula(newFormula)
    setSaved(false)

    setTimeout(() => {
      const pos = cursor + separator.length + varKey.length
      ta?.setSelectionRange(pos, pos)
      ta?.focus()
    }, 0)
  }

  // Save handler
  const handleSave = async () => {
    const result = formulaSchema.safeParse(formula)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setSaving(true)
    try {
      // Upserts Config row: scope = "GLOBAL", key = "healthFormula", value = formula string.
      // Uses Prisma upsert server-side so concurrent writes always converge on latest value.
      // The API route should do:
      //   await prisma.config.upsert({
      //     where:  { scope_key: { scope: 'GLOBAL', key: 'healthFormula' } },
      //     update: { value: formula },
      //     create: { scope: 'GLOBAL', projectId: null, key: 'healthFormula', value: formula },
      //   })
      const res = await fetch('/api/config/health-formula', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formula }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? 'Failed to save formula')
      }

      setSaved(true)
      onSaveSuccess?.(formula)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isValid = !error && formula.trim().length > 0

  return (
    <div className="font-mono flex flex-col gap-6 w-full mx-auto px-5 sm:px-10 lg:px-20 py-10">
      {/* ── Header ── */}
      <div>
        <h2 className="text-[#077CF1] font-extrabold text-sm uppercase tracking-widest m-0">
          Health Formula
        </h2>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
          Define the global health formula applied to all projects. Use the variables below with
          standard math operators (+, -, *, /, ^, sqrt, log, …). Click on any variable below for a
          quick insert into the formula. Auto-completion for variables is also provided.
        </p>
      </div>

      {/* ── Variable reference chips ── */}
      <div className="flex flex-wrap gap-2">
        {FORMULA_VARIABLES.map((v) => (
          <button
            key={v.key}
            onClick={() => insertVariable(v.key)}
            title={v.description}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border cursor-pointer
                       outline-none transition-all duration-150 hover:-translate-y-px"
            style={{
              borderColor: `${v.color}33`,
              background: v.bg,
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = v.color
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = `${v.color}33`
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: v.color }} />
            <span className="text-[0.72rem] font-semibold tracking-wide" style={{ color: v.color }}>
              {v.key}
            </span>
          </button>
        ))}
      </div>

      {/* ── Input area ── */}
      <div className="relative">
        {/* Gradient border wrapper — inline style required for dynamic gradient */}
        <div
          className="rounded-2xl p-0.5 transition-all duration-300"
          style={{
            background: error
              ? 'linear-gradient(135deg, #E333A3 0%, #ff6b6b 100%)'
              : isValid
                ? 'linear-gradient(135deg, #077CF1 0%, #0FAAA0 100%)'
                : 'linear-gradient(135deg, #2a2a3e 0%, #3a3a5e 100%)',
          }}
        >
          <div className="rounded-[14px] bg-[#0d0f1a] relative overflow-hidden">
            {/* Syntax highlight overlay */}
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 px-4 py-3.5 font-mono text-[0.88rem] leading-[1.7]
                         whitespace-pre-wrap break-words pointer-events-none overflow-hidden
                         select-none"
              dangerouslySetInnerHTML={{ __html: highlightFormula(formula) }}
            />

            {/* Actual textarea */}
            <textarea
              ref={textareaRef}
              value={formula}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              placeholder="e.g.  prs * 2 + commits + discord_messages / 10"
              rows={3}
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              className="block w-full px-4 py-3.5 font-mono text-[0.88rem] leading-[1.7]
                         bg-transparent border-none outline-none resize-y
                         relative z-10 text-transparent placeholder:text-[#3a3f5c]"
              style={{ caretColor: '#077CF1' }}
            />
          </div>
        </div>

        {/* ── Autocomplete dropdown ── */}
        {suggestions.length > 0 && (
          <div
            ref={suggBoxRef}
            className="absolute top-[calc(100%+6px)] left-0 z-50 bg-[#12141f]
                       border border-[#077CF133] rounded-xl overflow-hidden min-w-[220px]
                       shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            {suggestions.map((v, i) => (
              <div
                key={v.key}
                onClick={() => applySuggestion(v.key)}
                onMouseEnter={() => setActiveSuggIdx(i)}
                className="flex items-center gap-2.5 px-3.5 py-2 cursor-pointer transition-colors duration-100"
                style={{
                  background: i === activeSuggIdx ? '#077CF115' : 'transparent',
                  borderLeft:
                    i === activeSuggIdx ? `3px solid ${v.color}` : '3px solid transparent',
                }}
              >
                <span className="font-bold text-[0.8rem]" style={{ color: v.color }}>
                  {v.key}
                </span>
                <span className="text-[0.7rem] text-gray-500">{v.description}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Validation error ── */}
      {error && (
        <div
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl
                        bg-[#E333A3]/[0.08] border border-[#E333A3]/25"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="7" stroke="#E333A3" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="#E333A3" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[#E333A3] text-xs">{error}</span>
        </div>
      )}

      {/* ── Live preview ── */}
      {formula.trim() && (
        <div
          className="flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200"
          style={{
            background: preview.error ? 'rgba(227,51,163,0.06)' : 'rgba(7,124,241,0.08)',
            borderColor: preview.error ? 'rgba(227,51,163,0.2)' : 'rgba(7,124,241,0.2)',
          }}
        >
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.7rem] text-gray-500 uppercase tracking-widest">
              Preview score
            </span>
            <span className="text-[0.65rem] text-gray-600">
              (prs=4, lines_changed=320, discord_messages=47, commits=12)
            </span>
          </div>
          {preview.error ? (
            <span className="text-[0.8rem] text-[#E333A3]">—</span>
          ) : (
            <span className="text-[1.4rem] font-extrabold text-[#077CF1] tracking-tight">
              {preview.result !== null ? Math.round(preview.result * 100) / 100 : '—'}
            </span>
          )}
        </div>
      )}

      {/* ── Save button ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isValid || saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-none
                     font-mono text-[0.8rem] font-bold uppercase tracking-widest
                     transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            background:
              isValid && !saving ? 'linear-gradient(135deg, #077CF1 0%, #0FAAA0 100%)' : '#1f2231',
            color: isValid && !saving ? '#fff' : '#4b5563',
          }}
        >
          {saving ? (
            <>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="animate-spin">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeDasharray="20 15"
                />
              </svg>
              Saving…
            </>
          ) : (
            <>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8l4 4 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Save Formula
            </>
          )}
        </button>

        {saved && (
          <span className="flex items-center gap-1 text-[#0FAAA0] text-xs">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 8l4 4 6-6"
                stroke="#0FAAA0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Saved
          </span>
        )}
      </div>
    </div>
  )
}
