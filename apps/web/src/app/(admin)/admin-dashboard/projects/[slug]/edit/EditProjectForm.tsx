'use client'

import type { SubmitEvent } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

// Minimal type definition to accept the project from the server component
type ProjectWithRelations = {
  id: string
  name: string
  slug: string
  description: string | null
  repositories: { owner: string; name: string }[]
  channels: { externalId: string }[]
}

export default function EditProjectForm({ project }: { project: ProjectWithRelations }) {
  const router = useRouter()
  const [repos, setRepos] = useState<string[]>(
    project.repositories.map((r) => `https://github.com/${r.owner}/${r.name}`)
  )
  const [repoInput, setRepoInput] = useState('')
  const [channels, setChannels] = useState<string[]>(project.channels.map((c) => c.externalId))
  const [channelInput, setChannelInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const addRepo = () => {
    if (repoInput.trim()) {
      setRepos((prev) => [...prev, repoInput.trim()])
      setRepoInput('')
    }
  }

  const addChannel = () => {
    if (channelInput.trim()) {
      setChannels((prev) => [...prev, channelInput.trim()])
      setChannelInput('')
    }
  }

  const handleRemoveRepo = async (repoUrl: string, index: number) => {
    try {
      const parts = repoUrl.split('/')
      const owner = parts[3]
      const name = parts[4]

      if (owner && name) {
        const response = await fetch(
          `/api/project/check-repo?owner=${encodeURIComponent(owner)}&name=${encodeURIComponent(name)}`
        )
        if (response.ok) {
          const data = await response.json()
          if (data.hasData) {
            const confirmed = window.confirm(
              `Warning: There is commit and/or PR history associated with ${owner}/${name} in this project.\n\nDo you want to proceed?`
            )
            if (!confirmed) {
              return
            }
          }
        }
      }
    } catch {
      // Ignore validation errors and allow removal fallback
    }

    setRepos((prev) => prev.filter((_, j) => j !== index))
  }

  const handleSubmit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const formData = new FormData(event.currentTarget)
    // Add projectId
    formData.append('projectId', project.id)

    // The hidden inputs in the JSX handle the first item. We append the rest manually if any,
    // or just append all of them to be safe (and remove the hidden inputs).
    // It's cleaner to remove the hidden inputs and just append all here:
    repos.forEach((r) => formData.append('githubLinks', r))
    channels.forEach((c) => formData.append('discordSnowflakeIds', c))

    const response = await fetch('/api/project', { method: 'PATCH', body: formData })

    if (!response.ok) {
      const text = await response.text()
      try {
        const data = JSON.parse(text)
        setError(data?.error ?? data?.message ?? text)
      } catch {
        setError(text)
      }
      return
    }

    setSuccess(true)
    setTimeout(() => router.replace('/projects/' + project.slug), 1200)
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
            Edit Project
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            Update the details for <span className="font-bold text-wdcc-oshan">{project.name}</span>
            . Required fields are marked <span className="text-wdcc-kelvin">*</span>
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
          href={`/projects/${project.slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors mb-6"
        >
          ← back to project
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
            <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">
              / projects / {project.slug} / edit
            </p>
            <div
              className="h-px mb-8"
              style={{
                background:
                  'linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4))',
              }}
            />

            {/* Core fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                  Project Name <span className="text-wdcc-kelvin">*</span>
                </label>
                <input
                  type="text"
                  name="projectName"
                  required
                  defaultValue={project.name}
                  placeholder="e.g. WDCC Website 2025"
                  className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                  Description
                </label>
                <textarea
                  name="projectDescription"
                  rows={3}
                  defaultValue={project.description || ''}
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

              {repos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {repos.map((r, i) => (
                    <Chip key={i} color="blue" onRemove={() => handleRemoveRepo(r, i)}>
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

            <div className="flex flex-col gap-2">
              <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                Snowflake ID <span className="text-wdcc-kelvin">*</span>
              </label>
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    value={channelInput}
                    onChange={(e) => setChannelInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addChannel())}
                    placeholder="e.g. 1234567890123456789"
                    className="w-full font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-kelvin focus:bg-white focus:ring-2 focus:ring-wdcc-kelvin/10 transition-all placeholder:text-wdcc-grey-light"
                  />
                  <p className="font-mono text-[11px] text-wdcc-grey-light mt-1">
                    Right-click a channel in Discord → Copy Channel ID
                  </p>
                </div>
                <button
                  type="button"
                  onClick={addChannel}
                  className="font-mono text-xs text-wdcc-kelvin bg-wdcc-kelvin/10 hover:bg-wdcc-kelvin/20 border-[1.5px] border-wdcc-kelvin/30 rounded-xl px-4 transition-all self-start mt-0 py-2.5"
                >
                  Add
                </button>
              </div>

              {channels.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {channels.map((c, i) => (
                    <Chip
                      key={i}
                      color="pink"
                      onRemove={() => setChannels((prev) => prev.filter((_, j) => j !== i))}
                    >
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
            </div>

            {/* Status */}
            {error && (
              <div className="mt-4 flex items-center gap-2 bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 rounded-xl px-4 py-3 font-mono text-xs text-wdcc-kelvin">
                ✗ &nbsp;{error}
              </div>
            )}
            {success && (
              <div className="mt-4 flex items-center gap-2 bg-wdcc-mint border border-green-200 rounded-xl px-4 py-3 font-mono text-xs text-green-700">
                ✓ &nbsp;Project updated successfully! Redirecting…
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-wdcc-grey-light/20">
              <Link
                href={`/projects/${project.slug}`}
                className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2.5 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-oshan/80 transition-all duration-150 rounded-xl px-6 py-2.5"
              >
                <span>→</span>
                Save Changes
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
