'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import {
  evaluatePreview,
  FORMULA_VARIABLES,
  getActiveSuggestions,
  highlightFormula,
} from '@/lib/admin/formula'
import { formulaSchema } from '@/lib/schemas/admin'

export interface FormulaInputProps {
  type: 'Health' | 'MVP'
  initialFormula?: string | null
  onSaveSuccess?: (formula: string) => void
}

export default function FormulaInput({
  type,
  initialFormula = null,
  onSaveSuccess,
}: FormulaInputProps) {
  const [formula, setFormula] = useState(initialFormula ?? '')
  const [savedFormula, setSavedFormula] = useState<string | null>(initialFormula ?? null)
  const [loadingInitial, setLoadingInitial] = useState(initialFormula == null)
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

  const syncScroll = useCallback(() => {
    if (overlayRef.current && textareaRef.current) {
      overlayRef.current.scrollTop = textareaRef.current.scrollTop
      overlayRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [])

  useEffect(() => {
    if (initialFormula != null) return
    const load = async () => {
      try {
        const res = await fetch(`/api/formula/${type.toLowerCase()}`)
        if (!res.ok) return
        const data = (await res.json()) as { formula: string | null }
        if (data.formula) {
          setFormula(data.formula)
          setSavedFormula(data.formula)
        }
      } finally {
        setLoadingInitial(false)
      }
    }
    load()
  }, [initialFormula, type])

  useEffect(() => {
    if (!formula.trim()) {
      setError(null)
      return
    }
    const result = formulaSchema.safeParse(formula)
    setError(result.success ? null : result.error.issues[0].message)
  }, [formula])

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

  const applySuggestion = (varKey: string) => {
    const cursor = textareaRef.current?.selectionStart ?? formula.length
    const word = formula.slice(suggWordStart, cursor)
    const before = formula.slice(0, suggWordStart)
    const after = formula.slice(suggWordStart + word.length)
    setFormula(before + varKey + after)
    setSuggestions([])

    setTimeout(() => {
      const pos = suggWordStart + varKey.length
      textareaRef.current?.setSelectionRange(pos, pos)
      textareaRef.current?.focus()
    }, 0)
  }

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

  const insertVariable = (varKey: string) => {
    const ta = textareaRef.current
    const cursor = ta?.selectionStart ?? formula.length
    const before = formula.slice(0, cursor)
    const after = formula.slice(cursor)
    const separator = before.length > 0 && !/[\s(]$/.test(before) ? ' ' : ''
    setFormula(before + separator + varKey + after)
    setSaved(false)

    setTimeout(() => {
      const pos = cursor + separator.length + varKey.length
      ta?.setSelectionRange(pos, pos)
      ta?.focus()
    }, 0)
  }

  const handleSave = async () => {
    const result = formulaSchema.safeParse(formula)
    if (!result.success) {
      setError(result.error.issues[0].message)
      return
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/formula/${type.toLowerCase()}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formula }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? 'Failed to save formula')
      }

      setSaved(true)
      setSavedFormula(formula)
      onSaveSuccess?.(formula)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const isValid = !error && formula.trim().length > 0
  const isDirty = savedFormula !== null && formula !== savedFormula
  const unchanged = savedFormula !== null && formula === savedFormula

  if (loadingInitial) {
    return (
      <div className="font-mono flex flex-col gap-6 w-full mx-auto px-5 sm:px-10 lg:px-20 py-10 animate-pulse">
        <div className="h-4 w-36 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="flex gap-2">
          {[80, 112, 140, 72].map((w, i) => (
            <div key={i} className="h-6 rounded-lg bg-white/10" style={{ width: w }} />
          ))}
        </div>
        <div className="h-24 rounded-2xl bg-white/5" />
      </div>
    )
  }

  return (
    <div className="font-mono flex flex-col gap-6 w-full mx-auto px-5 sm:px-10 lg:px-20 py-10">
      {/* Header */}
      <div>
        <h2 className="text-[#077CF1] font-extrabold text-sm uppercase tracking-widest m-0">
          {type} Formula
        </h2>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
          Define the global {type.toLowerCase()} formula applied to all projects. Use the variables
          below with standard math operators (+, -, *, /, ^, sqrt, log, …). Click on any variable
          below for a quick insert into the formula. Auto-completion for variables is also provided.
          <br />
          <br />
          <strong>NOTE:</strong> Two or more variables in succession without an operator between
          them will be treated as multiplied (e.g. prs discord_messages = prs * discord_messages).
        </p>
      </div>

      {/* Currently saved formula */}
      {savedFormula && (
        <div
          className="rounded-2xl px-4 py-3.5 border"
          style={{
            background: 'rgba(15,170,160,0.08)',
            borderColor: 'rgba(15,170,160,0.25)',
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="flex items-center justify-center w-5 h-5 rounded-full shrink-0"
                style={{ background: 'rgba(15,170,160,0.15)' }}
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 8l4 4 6-6"
                    stroke="#0FAAA0"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span className="text-[0.65rem] text-[#0FAAA0]/80 uppercase tracking-widest font-bold">
                Currently saved
              </span>
            </div>
            {isDirty && (
              <span
                className="px-2 py-0.5 rounded-full text-[0.6rem] text-[#E333A3] uppercase tracking-widest font-bold"
                style={{ background: 'rgba(227,51,163,0.12)' }}
              >
                Unsaved changes
              </span>
            )}
          </div>
          <code className="block mt-2 text-[0.82rem] text-[#0FAAA0] break-all leading-snug">
            {savedFormula}
          </code>
        </div>
      )}

      {/* Variable reference chips */}
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

      {/* Input area */}
      <div className="relative">
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
            <div
              ref={overlayRef}
              aria-hidden="true"
              className="absolute inset-0 px-4 py-3.5 font-mono text-[0.88rem] leading-[1.7]
                         whitespace-pre-wrap break-words pointer-events-none overflow-hidden
                         select-none"
              dangerouslySetInnerHTML={{ __html: highlightFormula(formula) }}
            />
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

      {/* Validation error */}
      {error && (
        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#E333A3]/[0.08] border border-[#E333A3]/25">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
            <circle cx="8" cy="8" r="7" stroke="#E333A3" strokeWidth="1.5" />
            <path d="M8 5v4M8 11v.5" stroke="#E333A3" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="text-[#E333A3] text-xs">{error}</span>
        </div>
      )}

      {/* Live preview */}
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

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isValid || saving || unchanged}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-none
             font-mono text-[0.8rem] font-bold uppercase tracking-widest
             transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            background:
              isValid && !saving && !unchanged
                ? 'linear-gradient(135deg, #077CF1 0%, #0FAAA0 100%)'
                : '#1f2231',
            color: isValid && !saving && !unchanged ? '#fff' : '#4b5563',
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
