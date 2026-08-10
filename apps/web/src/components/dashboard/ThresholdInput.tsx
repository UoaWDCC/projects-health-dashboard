'use client'

import { useEffect, useState } from 'react'
import { healthScoreThresholdInputSchema } from '@/lib/schemas/admin'

type ThresholdKey = 'week' | 'avg4w'

interface ThresholdValues {
  week: number
  avg4w: number
}

const FIELDS: { key: ThresholdKey; label: string; help: string }[] = [
  {
    key: 'week',
    label: 'Single-week threshold',
    help: "Flags a project when this week's health score falls below this value.",
  },
  {
    key: 'avg4w',
    label: '4-week average threshold',
    help: 'Flags a project when its 4-week average health score falls below this value.',
  },
]

export default function ThresholdInput() {
  const [values, setValues] = useState<Record<ThresholdKey, string>>({ week: '', avg4w: '' })
  const [saved, setSaved] = useState<ThresholdValues | null>(null)
  const [loadingInitial, setLoadingInitial] = useState(true)
  const [errors, setErrors] = useState<Record<ThresholdKey, string | null>>({
    week: null,
    avg4w: null,
  })
  const [saving, setSaving] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/threshold')
        if (!res.ok) return
        const data = (await res.json()) as ThresholdValues
        setValues({ week: String(data.week), avg4w: String(data.avg4w) })
        setSaved(data)
      } catch (e) {
        console.error('Failed to load thresholds', e)
      } finally {
        setLoadingInitial(false)
      }
    }
    load()
  }, [])

  const handleChange = (key: ThresholdKey, raw: string) => {
    setValues((v) => ({ ...v, [key]: raw }))
    setJustSaved(false)
    const result = healthScoreThresholdInputSchema.safeParse(raw)
    setErrors((e) => ({ ...e, [key]: result.success ? null : result.error.issues[0].message }))
  }

  const isDirty =
    saved !== null && (values.week !== String(saved.week) || values.avg4w !== String(saved.avg4w))
  const isValid =
    !errors.week && !errors.avg4w && values.week.trim() !== '' && values.avg4w.trim() !== ''

  const handleSave = async () => {
    const weekResult = healthScoreThresholdInputSchema.safeParse(values.week)
    const avg4wResult = healthScoreThresholdInputSchema.safeParse(values.avg4w)
    if (!weekResult.success || !avg4wResult.success) {
      setErrors({
        week: weekResult.success ? null : weekResult.error.issues[0].message,
        avg4w: avg4wResult.success ? null : avg4wResult.error.issues[0].message,
      })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/threshold', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: weekResult.data, avg4w: avg4wResult.data }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body?.message ?? 'Failed to save thresholds')
      }

      const data = (await res.json()) as ThresholdValues
      setSaved(data)
      setValues({ week: String(data.week), avg4w: String(data.avg4w) })
      setJustSaved(true)
    } catch (e) {
      setErrors((prev) => ({
        ...prev,
        week: e instanceof Error ? e.message : 'Failed to save',
      }))
    } finally {
      setSaving(false)
    }
  }

  if (loadingInitial) {
    return (
      <div className="font-mono flex flex-col gap-6 w-full mx-auto px-5 sm:px-10 lg:px-20 py-10 animate-pulse">
        <div className="h-4 w-56 rounded bg-white/10" />
        <div className="h-3 w-full rounded bg-white/5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="h-20 rounded-2xl bg-white/5" />
          <div className="h-20 rounded-2xl bg-white/5" />
        </div>
      </div>
    )
  }

  return (
    <div className="font-mono flex flex-col gap-6 w-full mx-auto px-5 sm:px-10 lg:px-20 py-10">
      {/* Header */}
      <div>
        <h2 className="text-[#077CF1] font-extrabold text-sm uppercase tracking-widest m-0">
          Struggling-Project Thresholds
        </h2>
        <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">
          Set the health score thresholds used to flag struggling projects on the all-projects
          overview. A project is flagged if it falls below either threshold.
        </p>
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="flex flex-col gap-2">
            <label
              htmlFor={`threshold-${f.key}`}
              className="text-[0.78rem] font-bold text-[#077CF1]"
            >
              {f.label}
            </label>
            <p className="text-[0.7rem] text-gray-500 leading-snug -mt-1">{f.help}</p>
            <div
              className="rounded-2xl p-0.5 transition-all duration-300"
              style={{
                background: errors[f.key]
                  ? 'linear-gradient(135deg, #E333A3 0%, #ff6b6b 100%)'
                  : 'linear-gradient(135deg, #2a2a3e 0%, #3a3a5e 100%)',
              }}
            >
              <input
                id={`threshold-${f.key}`}
                type="number"
                inputMode="numeric"
                value={values[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="block w-full px-4 py-3 rounded-[14px] bg-[#0d0f1a] font-mono text-[0.88rem]
                           text-gray-100 border-none outline-none"
                style={{ caretColor: '#077CF1' }}
              />
            </div>
            {errors[f.key] && <span className="text-[#E333A3] text-xs">{errors[f.key]}</span>}
          </div>
        ))}
      </div>

      {/* Save controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleSave}
          disabled={!isValid || saving || !isDirty}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl border-none
             font-mono text-[0.8rem] font-bold uppercase tracking-widest
             transition-all duration-200 disabled:cursor-not-allowed"
          style={{
            background:
              isValid && !saving && isDirty
                ? 'linear-gradient(135deg, #077CF1 0%, #0FAAA0 100%)'
                : '#1f2231',
            color: isValid && !saving && isDirty ? '#fff' : '#4b5563',
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
              Save
            </>
          )}
        </button>

        {justSaved && (
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
