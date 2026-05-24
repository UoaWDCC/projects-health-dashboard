'use client'

import { useEffect, useState, use, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { ProjectMember } from '@repo/db'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

const inputClass =
  'font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light w-full'
const labelClass = 'font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold'

export default function EditMemberPage({
  params,
}: {
  params: Promise<{ slug: string; memberId: string }>
}) {
  const { slug, memberId } = use(params)
  const router = useRouter()

  const [membership, setMembership] = useState<ProjectMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)

  useEffect(() => {
    fetch(`/api/projects/${slug}/members/${memberId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ProjectMember | null) => {
        if (data) {
          setMembership(data)
          setDisplayName(data.displayName ?? '')
          setIsActive(data.isActive)
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [slug, memberId])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    const res = await fetch(`/api/people/${membership?.personId}/memberships/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: displayName.trim() || null,
        isActive,
      }),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data?.error ?? 'Failed to update membership')
      return
    }
    setSuccess(true)
    setTimeout(() => router.push(`/projects/${slug}`), 1200)
  }

  const handleUnlink = async () => {
    setError(null)

    const res = await fetch(`/api/people/${membership?.personId}/memberships/${memberId}`, {
      method: 'DELETE',
    })

    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      setError(data?.error ?? 'Failed to unlink member')
      setConfirmUnlink(false)
      return
    }

    router.push(`/projects/${slug}`)
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Loading...</p>
      </div>
    )

  if (!membership)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Member not found.</p>
      </div>
    )

  return (
    <>
      {/* Header */}
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-wdcc-grey-light">
            projects / {slug} / members / {memberId}
          </p>
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            Edit Member
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            Update membership settings for{' '}
            <span className="text-wdcc-oshan font-semibold">
              {membership.displayName ?? memberId}
            </span>{' '}
            in <span className="text-wdcc-oshan font-semibold">{slug}</span>.
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

      <div className="mt-44 px-5 sm:px-10 lg:px-20 pb-20 flex flex-col gap-6">
        <Link
          href={`/projects/${slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors"
        >
          ← {slug}
        </Link>

        {/* Edit form */}
        <form onSubmit={handleSave}>
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
              Membership Settings
            </p>
            <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">
              / projects / {slug} / members / {memberId}
            </p>
            <div
              className="h-px mb-8"
              style={{
                background:
                  'linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4))',
              }}
            />

            {/* Member info — read only */}
            <div className="flex gap-3 mb-6 flex-wrap">
              <div className="flex items-center gap-1.5 bg-wdcc-blue/10 rounded-lg px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey-light">
                  Project
                </span>
                <span className="font-mono text-sm font-semibold text-wdcc-blue">{slug}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-3 py-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey-light">
                  Joined
                </span>
                <span className="font-mono text-sm text-wdcc-grey">
                  {new Date(membership.joinedAt).toLocaleDateString('en-NZ', {
                    dateStyle: 'medium',
                  })}
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${membership.isActive ? 'bg-wdcc-mint' : 'bg-wdcc-grey-light/10'}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${membership.isActive ? 'bg-green-500' : 'bg-wdcc-grey-light'}`}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest font-semibold ${membership.isActive ? 'text-green-700' : 'text-wdcc-grey-light'}`}
                >
                  {membership.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-5">
              {/* Display name */}
              <div className="flex flex-col gap-1.5">
                <label className={labelClass}>Display name override</label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={membership.displayName ?? 'Display name'}
                  className={inputClass}
                />
                <p className="font-mono text-[11px] text-wdcc-grey-light">
                  Leave blank to inherit the global display name.
                </p>
              </div>

              {/* Active toggle */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="mt-0.5 accent-[#077CF1]"
                />
                <div>
                  <p className="font-mono text-sm font-semibold text-wdcc-oshan">Active member</p>
                  <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">
                    Uncheck to softly remove from this project without unlinking the membership
                    record.
                  </p>
                </div>
              </label>
            </div>

            {/* Status */}
            {error && (
              <div className="mt-5 flex items-center gap-2 bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 rounded-xl px-4 py-3 font-mono text-xs text-wdcc-kelvin">
                ✗ &nbsp;{error}
              </div>
            )}
            {success && (
              <div className="mt-5 flex items-center gap-2 bg-wdcc-mint border border-green-200 rounded-xl px-4 py-3 font-mono text-xs text-green-700">
                ✓ &nbsp;Membership updated. Redirecting…
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-wdcc-grey-light/20">
              <Link
                href={`/projects/${slug}`}
                className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2.5 transition-all"
              >
                Cancel
              </Link>
              <button
                type="submit"
                className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-blue rounded-xl px-6 py-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(7,124,241,0.25)]"
              >
                <span>→</span> Save changes
              </button>
            </div>
          </div>
        </form>

        {/* Danger zone */}
        <div
          className="transition-all duration-300"
          style={{
            borderRadius: '24px',
            border: '3px solid transparent',
            background:
              'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(227,51,163,0.4), rgba(227,51,163,0.4)) border-box',
            padding: '36px 40px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(227,51,163,1), rgba(227,51,163,1)) border-box'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(227,51,163,0.4), rgba(227,51,163,0.4)) border-box'
          }}
        >
          <p className="font-extrabold text-wdcc-kelvin uppercase tracking-widest text-lg mb-1">
            Danger Zone
          </p>
          <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">
            Unlink this member from the project.
          </p>
          <div className="h-px mb-6" style={{ background: 'rgba(227,51,163,0.2)' }} />

          <div className="flex items-start justify-between gap-6 flex-wrap">
            <div>
              <p className="font-mono text-sm font-semibold text-wdcc-oshan">Unlink from project</p>
              <p className="font-mono text-[11px] text-wdcc-grey-light mt-1">
                Removes{' '}
                <span className="text-wdcc-oshan">{membership.displayName ?? memberId}</span> from{' '}
                <span className="text-wdcc-oshan">{slug}</span>. If this is their only project,
                their person record and identities will also be deleted.
              </p>
            </div>

            {confirmUnlink ? (
              <div className="flex items-center gap-3 shrink-0">
                <p className="font-mono text-xs text-wdcc-kelvin">Are you sure?</p>
                <button
                  type="button"
                  onClick={() => setConfirmUnlink(false)}
                  className="font-mono text-xs text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-4 py-2 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUnlink}
                  className="font-mono text-xs font-semibold text-white bg-wdcc-kelvin hover:bg-wdcc-kelvin/80 rounded-xl px-4 py-2 transition-all"
                >
                  Yes, unlink
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmUnlink(true)}
                className="shrink-0 font-mono text-xs font-semibold text-wdcc-kelvin bg-wdcc-kelvin/10 hover:bg-wdcc-kelvin/20 border-[1.5px] border-wdcc-kelvin/30 rounded-xl px-4 py-2.5 transition-all"
              >
                Unlink from project
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
