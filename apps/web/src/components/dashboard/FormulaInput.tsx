'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  evaluatePreview,
  FORMULA_VARIABLES,
  getActiveSuggestions,
  highlightFormula,
} from '@/lib/admin/formula'
import { formulaSchema } from '@/lib/schemas/admin'

interface MvpApiEntry {
  projectId: string
  mvp: { displayName: string; linesAdded: number; commits: number }
}

const formulaTypography = 'px-4 py-3.5 font-mono text-[0.88rem] leading-[1.7]'

const secondaryActionButton =
  'inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border font-mono text-[0.8rem] scale-110 ' +
  'font-bold uppercase tracking-widest transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed'

const primaryActionButton =
  'inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full border-none font-mono text-[0.8rem] ' +
  'font-bold uppercase tracking-widest scale-110 transition-all duration-200 disabled:cursor-not-allowed'

const modalActionButton =
  'inline-flex items-center px-4 py-2 rounded-full font-mono text-[0.75rem] font-bold ' +
  'uppercase tracking-widest transition-colors duration-150'

const SAVED_AT_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

function formatSavedAt(date: Date): string {
  return SAVED_AT_FORMATTER.format(date)
}

export interface FormulaInputProps {
  type: 'Health' | 'MVP'
  initialFormula?: string | null
  onSaveSuccess?: (formula: string) => void
}

const NEW_MVP_NAME = 'Drew Hayes'

export default function FormulaInput({
  type,
  initialFormula = null,
  onSaveSuccess,
}: FormulaInputProps) {
  const [formula, setFormula] = useState(initialFormula ?? '')
  const [savedFormula, setSavedFormula] = useState<string | null>(initialFormula ?? null)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(initialFormula == null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [suggestions, setSuggestions] = useState<(typeof FORMULA_VARIABLES)[number][]>([])
  const [activeSuggIdx, setActiveSuggIdx] = useState(0)
  const [suggWordStart, setSuggWordStart] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')
  const [latestMvpName, setLatestMvpName] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const suggBoxRef = useRef<HTMLDivElement>(null)

  const preview = useMemo(() => evaluatePreview(formula), [formula])
  const highlightedFormula = useMemo(() => highlightFormula(formula), [formula])

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
        const data = (await res.json()) as { formula: string | null; updatedAt: string | null }
        if (data.formula) {
          setFormula(data.formula)
          setSavedFormula(data.formula)
          setSavedAt(data.updatedAt ? new Date(data.updatedAt) : null)
        }
      } finally {
        setLoadingInitial(false)
      }
    }
    load()
  }, [initialFormula, type])

  useEffect(() => {
    if (type !== 'MVP') return
    const load = async () => {
      try {
        const res = await fetch('/api/mvp')
        if (!res.ok) return
        const entries = (await res.json()) as MvpApiEntry[]
        const best = entries.reduce<MvpApiEntry | null>((top, cur) => {
          if (!top) return cur
          if (cur.mvp.linesAdded !== top.mvp.linesAdded) {
            return cur.mvp.linesAdded > top.mvp.linesAdded ? cur : top
          }
          if (cur.mvp.commits !== top.mvp.commits) {
            return cur.mvp.commits > top.mvp.commits ? cur : top
          }
          return cur.mvp.displayName < top.mvp.displayName ? cur : top
        }, null)
        setLatestMvpName(best?.mvp.displayName ?? null)
      } catch {}
    }
    load()
  }, [type])

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

      const body = (await res.json()) as { formula: string; updatedAt: string }
      setSavedFormula(formula)
      setSavedAt(new Date(body.updatedAt))
      onSaveSuccess?.(formula)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  const handleRevert = () => {
    setFormula(savedFormula ?? '')
    setSuggestions([])
  }

  const handleClear = () => {
    setFormula('')
    setSuggestions([])
  }

  const isValid = !error && formula.trim().length > 0
  const isDirty = savedFormula !== null && formula !== savedFormula
  const unchanged = savedFormula !== null && formula === savedFormula
  const typeLabel = type === 'Health' ? 'Health Score' : 'Weekly MVP'
  const confirmPhrase = `Change ${typeLabel}`

  const statusBadge = isDirty
    ? { text: 'unsaved changes', className: 'text-[#B3261E] bg-[#E8B9B9] font-bold' }
    : savedFormula && savedAt
      ? { text: `saved ${formatSavedAt(savedAt)}`, className: 'text-[#0C7A4A] bg-[#E8F7EF]' }
      : null

  const handleSaveClick = () => {
    setConfirmInput('')
    setConfirmOpen(true)
  }

  const handleConfirmSave = async () => {
    if (confirmInput !== confirmPhrase) return
    setConfirmOpen(false)
    await handleSave()
  }

  if (loadingInitial) {
    return (
      <div className="relative rounded-2xl overflow-visible mx-16">
        <div className="relative bg-white rounded-2xl m-[2px] font-mono flex flex-col gap-6 mx-auto px-5 sm:px-10 lg:px-20 py-10 animate-pulse">
          <div className="h-4 w-36 rounded bg-black/10" />
          <div className="h-3 w-full rounded bg-black/5" />
          <div className="flex gap-2">
            {[80, 112, 140, 72].map((w, i) => (
              <div key={i} className="h-6 rounded-lg bg-black/10" style={{ width: w }} />
            ))}
          </div>
          <div className="h-24 rounded-2xl bg-black/5" />
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="relative overflow-visible mx-16 rounded-2xl [background:linear-gradient(135deg,#9FC3FB_0%,#E7B6DA_50%,#F6CF9B_100%)]">
        <div className="relative bg-white rounded-[14px] m-[2px] overflow-hidden font-mono flex flex-col">
          {/* Header */}
          <div className="flex h-[5rem] shrink-0 items-center justify-between bg-[#F6F9FE]">
            <div className="flex items-center">
              <div
                className={`ml-7 h-6 w-[5px] rounded-xl ${type === 'Health' ? 'bg-wdcc-blue' : 'bg-wdcc-kelvin'}`}
              />
              <h2 className="pl-4 text-wdcc-oshan font-extrabold font-sans text-2xl tracking-tight">
                {typeLabel}
              </h2>
            </div>
            <div
              className={`flex items-center mr-5 px-4 h-8 rounded-full text-xs ${statusBadge?.className ?? ''}`}
            >
              {statusBadge?.text}
            </div>
          </div>

          <div className="flex flex-col gap-6 py-10 px-10">
            {/* Description */}
            <p className="text-gray-500 text-sm leading-loose text-align-last:justify]">
              <strong>Define the global {type} formula applied to all projects.</strong> Use the
              variables below with standard math operators (
              <span className="text-wdcc-kelvin"> + - * / ^ </span>) and functions (
              <span className="text-wdcc-kelvin"> sqrt, log, min, max </span>). Click on any
              variable below for a quick insert into the formula. Auto-completion for variables is
              also provided.
            </p>

            {/* Note */}
            <div className="flex gap-3 bg-[#f4f8fe] px-5 py-3 rounded-xl text-gray-500 text-xs leading-relaxed">
              <span className="shrink-0 font-bold text-[#0066FF] uppercase tracking-widest">
                Note
              </span>
              <span>
                Two or more variables in succession without an operator between them will be treated
                as multiplied (e.g. prs discord_messages = prs * discord_messages).
              </span>
            </div>

            {/* Currently saved formula */}
            {savedFormula && (
              <div className="rounded-2xl px-4 py-3.5 border bg-[#F1FAF6] border-[rgba(20,115,90,0.2)]">
                <div className="flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 bg-[#F1FAF6]">
                    <div className="h-[22px] w-[22px] text-center text-white rounded-full bg-[#1FB36B] shrink-0">
                      ✓
                    </div>
                  </span>
                  <span className="text-[0.8rem] font-normal text-[#0C7A4A]/70 uppercase tracking-widest">
                    Currently saved
                  </span>
                </div>
                <code className="block mt-2 text-[0.82rem] text-[#14735A] break-all leading-snug">
                  {savedFormula}
                </code>
              </div>
            )}

            {/* Quick insert + input */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[0.65rem] text-gray-500 uppercase tracking-widest font-bold">
                  Quick insert
                </span>
                <div className="flex flex-wrap gap-2">
                  {FORMULA_VARIABLES.map((v) => (
                    <button
                      key={v.key}
                      onClick={() => insertVariable(v.key)}
                      title={v.description}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl cursor-pointer
                       outline-none transition-all duration-150 hover:-translate-y-px"
                      style={{ background: v.bg }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: v.color }}
                      />
                      <span className="text-[0.72rem] tracking-wide" style={{ color: v.color }}>
                        {v.key}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div
                  className={`rounded-[14px] bg-[#0d0f1a] relative overflow-hidden border-2
                     transition-all duration-300 ${
                       error
                         ? 'border-[#E333A3] shadow-none'
                         : 'border-wdcc-blue shadow-[0_0_0_3px_rgba(7,124,241,0.1)]'
                     }`}
                >
                  <div
                    ref={overlayRef}
                    aria-hidden="true"
                    className={`absolute inset-0 ${formulaTypography} whitespace-pre-wrap break-words pointer-events-none overflow-hidden select-none`}
                    dangerouslySetInnerHTML={{ __html: highlightedFormula }}
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
                    className={`block w-full ${formulaTypography} bg-transparent border-none outline-none resize-y caret-[#077CF1] relative z-10 text-transparent placeholder:text-[#3a3f5c]`}
                  />
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
            </div>

            {/* Validation error */}
            {error && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#E333A3]/[0.08] border border-[#E333A3]/25">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
                  <circle cx="8" cy="8" r="7" stroke="#E333A3" strokeWidth="1.5" />
                  <path
                    d="M8 5v4M8 11v.5"
                    stroke="#E333A3"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[#E333A3] text-xs">{error}</span>
              </div>
            )}

            {/* Live preview */}
            {formula.trim() && (
              <div
                className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all duration-200 ${
                  preview.error
                    ? 'bg-[rgba(227,51,163,0.06)] border-[rgba(227,51,163,0.2)]'
                    : 'bg-[#F4F8FE] border-[rgba(7,124,241,0.2)]'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className="text-[0.7rem] text-gray-500 uppercase tracking-widest">
                    Preview score
                  </span>

                  <span className="text-[0.65rem] text-gray-600">
                    prs=4, lines_changed=320, discord_messages=47, commits=12
                  </span>
                </div>
                <div className="flex flex-col items-end gap-0">
                  {preview.error ? (
                    <span className="text-[0.8rem] text-[#E333A3]">—</span>
                  ) : (
                    <span className="text-[1.4rem] font-extrabold text-wdcc-blue tracking-tight">
                      {preview.result !== null ? Math.round(preview.result * 100) / 100 : '-'}
                    </span>
                  )}
                  {type === 'MVP' && (
                    <span className="inline-flex items-center text-[0.7rem] text-wdcc-grey-light">
                      MVP:{' '}
                      {latestMvpName && latestMvpName !== NEW_MVP_NAME && (
                        <>
                          <span className="text-wdcc-grey-light">{latestMvpName}</span>
                          <span className="mx-2 pb-1 text-lg leading-none">→</span>
                        </>
                      )}
                      <span className="font-bold text-wdcc-oshan">{NEW_MVP_NAME}</span>
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-6">
                <button
                  onClick={handleRevert}
                  disabled={!isDirty}
                  className={`${secondaryActionButton} text-[#161928] border-[#161928]/15 hover:bg-black/[0.03]`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M3 8a5 5 0 1 1 1.5 3.5M3 8V4M3 8h4"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Revert to Saved
                </button>

                <button
                  onClick={handleClear}
                  disabled={!formula}
                  className={`${secondaryActionButton} text-[#E333A3] border-[#E333A3]/25 hover:bg-[#E333A3]/5`}
                >
                  <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  Clear
                </button>
              </div>

              <button
                onClick={handleSaveClick}
                disabled={!isValid || saving || unchanged}
                className={`${primaryActionButton} ${
                  isValid && !saving && !unchanged
                    ? 'bg-[#077CF1] hover:bg-[#5E7A94] text-white'
                    : 'bg-[#1f2231] text-[#4b5563]'
                }`}
              >
                {saving ? (
                  <>
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="animate-spin"
                    >
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
            </div>
          </div>
        </div>
      </div>

      {confirmOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 font-mono shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm leading-relaxed text-black">
              You are about to make a change to the entire site affecting the {type} formula for all
              projects. Please type &quot;<strong>{confirmPhrase}</strong>&quot; to confirm.
            </p>
            <input
              autoFocus
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleConfirmSave()
              }}
              placeholder={confirmPhrase}
              className="mt-4 w-full rounded-xl border-2 border-wdcc-blue bg-transparent px-3 py-2 text-sm outline-none"
            />
            <div className="mt-5 flex justify-end gap-3">
              <button
                onClick={() => setConfirmOpen(false)}
                className={`${modalActionButton} border border-[#161928]/15 text-[#161928] hover:bg-black/[0.03]`}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={confirmInput !== confirmPhrase}
                className={`${modalActionButton} bg-[#E333A3] text-white hover:bg-[#b82b82]
                     disabled:cursor-not-allowed disabled:bg-[#1f2231] disabled:text-[#4b5563]`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
