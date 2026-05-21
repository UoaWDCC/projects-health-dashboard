'use client'

import type { FormEvent } from 'react'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

export default function CreateProjectPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [repos, setRepos] = useState<string[]>([])
  const [repoInput, setRepoInput] = useState('')
  const [channels, setChannels] = useState<{ snowflakeId: string; name: string }[]>([])
  const [channelIdInput, setChannelIdInput] = useState('')
  const [channelNameInput, setChannelNameInput] = useState('')
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addRepo = () => {
    if (repoInput.trim()) {
      setRepos((prev) => [...prev, repoInput.trim()])
      setRepoInput('')
    }
  }

  const addChannel = () => {
    const snowflakeId = channelIdInput.trim()
    const name = channelNameInput.trim()
    if (snowflakeId && name) {
      setChannels((prev) => [...prev, { snowflakeId, name }])
      setChannelIdInput('')
      setChannelNameInput('')
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    repos.forEach((r) => formData.append('githubLinks', r))
    channels.forEach((c) => {
      formData.append('discordSnowflakeIds', c.snowflakeId)
      formData.append('discordChannelNames', c.name)
    })

    const response = await fetch('/api/project', { method: 'POST', body: formData })

    if (!response.ok) {
      const text = await response.text()
      const data = JSON.parse(text)
      setError(data?.error ?? data?.message ?? text)
      return
    }

    setSuccess(true)
    setTimeout(() => router.replace('/admin-dashboard'), 1200)
  }

  return (
    <>
      {/* Header */}
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            New Project
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            Fill in the details below to register a new WDCC project. Required fields are marked{' '}
            <span className="text-wdcc-kelvin">*</span>
          </p>
        </div>

        <Image
          src="/webster.png"
          alt="Webster"
          width={200}
          height={200}
          className="drop-shadow-2xl translate-y-1/3 hidden sm:block shrink-0"
        />
      </div>

      {/* Form */}
      <div className="mt-44 px-5 sm:px-10 lg:px-20 pb-20">
        {/* Back link */}
        <Link
          href="/admin-dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors mb-6"
        >
          ← admin-dashboard
        </Link>

        <form onSubmit={handleSubmit}>
          {/* Card */}
          <div
            className="transition-all duration-300"
            style={{
              borderRadius: '24px',
              border: '3px solid transparent',
              background: BORDER_DEFAULT,
              padding: '36px 40px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = BORDER_HOVER
              e.currentTarget.style.boxShadow =
                '0 12px 32px rgba(227,51,163,0.12), 0 4px 12px rgba(7,124,241,0.08)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = BORDER_DEFAULT
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
              Project Details
            </p>
            <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">/ projects / new</p>
            <div
              className="h-px mb-8"
              style={{
                background:
                  'linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4))',
              }}
            />

            {/* Core fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                  Project Name <span className="text-wdcc-kelvin">*</span>
                </label>
                <input
                  type="text"
                  name="projectName"
                  required
                  placeholder="e.g. WDCC Website 2025"
                  className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                  Start Date
                </label>
                <input
                  type="month"
                  name="projectStartDate"
                  className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                  Description
                </label>
                <textarea
                  name="projectDescription"
                  rows={3}
                  placeholder="A brief overview of what this project does and who it's for..."
                  className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light resize-y"
                />
              </div>
            </div>

            {/* Repositories */}
            <SectionLabel color="blue" icon="repo">
              Repositories
            </SectionLabel>

            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  type="url"
                  value={repoInput}
                  onChange={(e) => setRepoInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRepo())}
                  placeholder="https://github.com/owner/repo"
                  className="flex-1 font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                />
                <button
                  type="button"
                  onClick={addRepo}
                  className="font-mono text-xs text-wdcc-blue bg-wdcc-blue/10 hover:bg-wdcc-blue/20 border-[1.5px] border-wdcc-blue/30 rounded-xl px-4 transition-all"
                >
                  Add
                </button>
              </div>
              {/* Hidden input for first/required repo */}
              <input type="hidden" name="githubLink" value={repos[0] ?? ''} />

              {repos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {repos.map((r, i) => (
                    <Chip
                      key={i}
                      color="blue"
                      onRemove={() => setRepos((prev) => prev.filter((_, j) => j !== i))}
                    >
                      {r.replace('https://github.com/', '')}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {/* Discord Channels */}
            <SectionLabel color="pink" icon="hash">
              Discord Channels
            </SectionLabel>

            <div className="flex flex-col gap-3">
              <p className="font-mono text-[11px] text-wdcc-grey-light">
                Each channel needs both a Snowflake ID and a name — click{' '}
                <span className="text-wdcc-kelvin font-semibold">Add Channel</span> to save the
                pair.
              </p>

              <div className="rounded-2xl border-[1.5px] border-dashed border-wdcc-kelvin/40 bg-wdcc-kelvin/5 p-4 flex flex-col gap-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                      Snowflake ID <span className="text-wdcc-kelvin">*</span>
                    </label>
                    <input
                      type="text"
                      value={channelIdInput}
                      onChange={(e) => setChannelIdInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChannel())}
                      placeholder="e.g. 1234567890123456789"
                      className="w-full font-mono text-sm text-wdcc-oshan bg-white border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-kelvin focus:ring-2 focus:ring-wdcc-kelvin/10 transition-all placeholder:text-wdcc-grey-light"
                    />
                    <p className="font-mono text-[11px] text-wdcc-grey-light">
                      Right-click a channel in Discord → Copy Channel ID
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                      Channel Name <span className="text-wdcc-kelvin">*</span>
                    </label>
                    <input
                      type="text"
                      value={channelNameInput}
                      onChange={(e) => setChannelNameInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChannel())}
                      placeholder="e.g. general"
                      className="w-full font-mono text-sm text-wdcc-oshan bg-white border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-kelvin focus:ring-2 focus:ring-wdcc-kelvin/10 transition-all placeholder:text-wdcc-grey-light"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addChannel}
                  disabled={!channelIdInput.trim() || !channelNameInput.trim()}
                  className="self-end font-mono text-xs font-semibold text-wdcc-kelvin bg-wdcc-kelvin/10 hover:bg-wdcc-kelvin/20 disabled:opacity-40 disabled:cursor-not-allowed border-[1.5px] border-wdcc-kelvin/30 rounded-xl px-4 py-2 transition-all"
                >
                  + Add Channel
                </button>
              </div>

              {/* Hidden inputs for first/required channel pair (server still reads single channel) */}
              <input
                type="hidden"
                name="discordSnowflakeId"
                value={channels[0]?.snowflakeId ?? ''}
              />
              <input type="hidden" name="discordChannelName" value={channels[0]?.name ?? ''} />

              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {channels.map((c, i) => (
                    <Chip
                      key={i}
                      color="pink"
                      onRemove={() => setChannels((prev) => prev.filter((_, j) => j !== i))}
                    >
                      #{c.name} · {c.snowflakeId}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {/* Project Image */}
            <SectionLabel color="pink" icon="image">
              Project Image
            </SectionLabel>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-[1.5px] border-dashed border-wdcc-kelvin/40 rounded-2xl p-6 text-center cursor-pointer hover:bg-wdcc-kelvin/5 hover:border-wdcc-kelvin/70 transition-all"
            >
              {imagePreview ? (
                <div className="flex items-center gap-3">
                  <div className="w-[52px] h-[52px] rounded-[14px] bg-[#d9d9d9] overflow-hidden shrink-0">
                    <Image
                      src={imagePreview}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="text-left">
                    <p className="font-mono text-sm font-semibold text-wdcc-oshan">{imageName}</p>
                    <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">
                      Click to change
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-mono text-sm text-wdcc-grey-light">
                    Click to upload project image
                  </p>
                  <p className="font-mono text-[10px] text-wdcc-grey-light/60 mt-1">
                    PNG, JPG, WEBP — max 4MB
                  </p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                name="image"
                accept="image/*"
                className="hidden"
                onChange={handleImageChange}
              />
            </div>

            {/* Status */}
            {error && (
              <div className="mt-4 flex items-center gap-2 bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 rounded-xl px-4 py-3 font-mono text-xs text-wdcc-kelvin">
                ✗ &nbsp;{error}
              </div>
            )}
            {success && (
              <div className="mt-4 flex items-center gap-2 bg-wdcc-mint border border-green-200 rounded-xl px-4 py-3 font-mono text-xs text-green-700">
                ✓ &nbsp;Project created successfully! Redirecting…
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-wdcc-grey-light/20">
              <Link
                href="/admin-dashboard"
                className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2.5 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-oshan/80 transition-all duration-150 rounded-xl px-6 py-2.5"
              >
                <span>→</span>
                Create Project
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}

/* ─── Helpers ─── */

function SectionLabel({
  children,
  color,
  icon,
}: {
  children: React.ReactNode
  color: 'blue' | 'pink'
  icon: 'repo' | 'hash' | 'image'
}) {
  const colorClass = color === 'blue' ? 'text-wdcc-blue' : 'text-wdcc-kelvin'
  const borderColor = color === 'blue' ? 'rgba(7,124,241,0.2)' : 'rgba(227,51,163,0.2)'
  return (
    <div
      className={`flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest font-semibold ${colorClass} mt-7 mb-4`}
    >
      {icon === 'repo' && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <circle cx="4" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="3" r="2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="4" cy="13" r="2" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M4 5v6M4 5c0 2 8 2 8 0"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
      {icon === 'hash' && <span className="text-base leading-none">#</span>}
      {icon === 'image' && (
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
      {children}
      <div className="flex-1 h-px" style={{ background: borderColor }} />
    </div>
  )
}

function Chip({
  children,
  color,
  onRemove,
}: {
  children: React.ReactNode
  color: 'blue' | 'pink'
  onRemove: () => void
}) {
  const classes =
    color === 'blue' ? 'bg-wdcc-blue/10 text-wdcc-blue' : 'bg-wdcc-kelvin/10 text-wdcc-kelvin'
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${classes} rounded-lg px-2.5 py-1.5 font-mono text-[11px] font-semibold`}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="opacity-60 hover:opacity-100 transition-opacity leading-none"
      >
        ×
      </button>
    </span>
  )
}
