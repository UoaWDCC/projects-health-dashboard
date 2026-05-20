/**
 * Member creation page — only should be accessible to administrators.
 * Should take in the necessary information to create a new member (e.g., project id, display name, etc.)
 * and store it in the database.
 *
 * TODO: Implement the design
 */

'use client'

import type { FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { use, useState, useEffect } from 'react'
import { IdentityProvider } from '@repo/db'
import Image from 'next/image'
import Link from 'next/link'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

type PersonIdentity = {
  id: string
  provider: IdentityProvider
  externalId: string
  username: string | null
}

type Person = {
  id: string
  displayName: string
  identities: PersonIdentity[]
}

export default function CreateMemberPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter()
  const { slug } = use(params)

  const [existingPeople, setExistingPeople] = useState<Person[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string>('NEW')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetch('/api/people')
      .then((res) => (res.ok ? res.json() : []))
      .then(setExistingPeople)
      .catch((e) => console.error('Failed to fetch people', e))
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const formData = new FormData(event.currentTarget)

    if (selectedPersonId !== 'NEW') {
      formData.append('personId', selectedPersonId)
    }

    const response = await fetch(`/api/project/${slug}/members`, {
      method: 'POST',
      body: formData,
    })

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
    setTimeout(() => router.push(`/projects/${slug}`), 1200)
  }

  const isExistingMember = selectedPersonId !== 'NEW'
  const selectedPerson = existingPeople.find((p) => p.id === selectedPersonId)

  return (
    <>
      {/* Header */}
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-wdcc-grey-light">
            projects / {slug} / members
          </p>
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            Add Member
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            Assign an existing person to this project, or create a brand new one.
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

      <div className="mt-44 px-5 sm:px-10 lg:px-20 pb-20">
        {/* Back link */}
        <Link
          href={`/projects/${slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors mb-6"
        >
          ← projects / {slug}
        </Link>

        <form onSubmit={handleSubmit}>
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
              Member Details
            </p>
            <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">
              / projects / {slug} / members / new
            </p>
            <div
              className="h-px mb-8"
              style={{
                background:
                  'linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4))',
              }}
            />

            {/* Person selector */}
            <div className="flex flex-col gap-1.5 mb-6">
              <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                Select person
              </label>
              <select
                value={selectedPersonId}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                name="personIdSelector"
                className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all"
              >
                <option value="NEW">— Create new person —</option>
                {existingPeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                    {person.identities.length > 0
                      ? ` (${person.identities.map((i) => `${i.provider}: ${i.username || i.externalId}`).join(', ')})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Existing person notice */}
            {isExistingMember && selectedPerson && (
              <div className="flex items-start gap-3 bg-wdcc-blue/5 border-[1.5px] border-wdcc-blue/20 rounded-xl px-4 py-3.5 mb-6">
                <div className="w-8 h-8 rounded-full bg-wdcc-purple flex items-center justify-center shrink-0 mt-0.5">
                  <span className="font-mono font-bold text-wdcc-kelvin text-xs">
                    {selectedPerson.displayName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-wdcc-oshan">
                    {selectedPerson.displayName}
                  </p>
                  {selectedPerson.identities.length > 0 && (
                    <div className="flex gap-2 flex-wrap mt-1.5">
                      {selectedPerson.identities.map((identity) => (
                        <span
                          key={identity.id}
                          className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2 py-1 rounded-lg font-semibold ${
                            identity.provider === 'GITHUB'
                              ? 'bg-wdcc-oshan/10 text-wdcc-oshan'
                              : 'bg-wdcc-kelvin/10 text-wdcc-kelvin'
                          }`}
                        >
                          {identity.provider}: {identity.username ?? identity.externalId}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="font-mono text-[11px] text-wdcc-grey-light mt-2">
                    Their existing name, photo, and identities will be preserved.
                  </p>
                </div>
              </div>
            )}

            {/* New person fields */}
            {!isExistingMember && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                    Full name / display name <span className="text-wdcc-kelvin">*</span>
                  </label>
                  <input
                    type="text"
                    name="displayName"
                    required
                    placeholder="e.g. Jane Smith"
                    className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                    Discord username / ID
                  </label>
                  <input
                    type="text"
                    name="discordId"
                    placeholder="e.g. janesmith or 123456789"
                    className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-kelvin focus:bg-white focus:ring-2 focus:ring-wdcc-kelvin/10 transition-all placeholder:text-wdcc-grey-light"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                    GitHub username
                  </label>
                  <input
                    type="text"
                    name="githubId"
                    placeholder="e.g. janesmith"
                    className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                  />
                </div>

                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
                    Profile photo URL
                  </label>
                  <input
                    type="text"
                    name="imageUrl"
                    placeholder="https://..."
                    className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
                  />
                </div>
              </div>
            )}

            {/* Status */}
            {error && (
              <div className="mt-5 flex items-center gap-2 bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 rounded-xl px-4 py-3 font-mono text-xs text-wdcc-kelvin">
                ✗ &nbsp;{error}
              </div>
            )}
            {success && (
              <div className="mt-5 flex items-center gap-2 bg-wdcc-mint border border-green-200 rounded-xl px-4 py-3 font-mono text-xs text-green-700">
                ✓ &nbsp;Member added successfully! Redirecting…
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
                className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-oshan/80 rounded-xl px-6 py-2.5 transition-all duration-150"
              >
                <span>→</span>
                Add Member
              </button>
            </div>
          </div>
        </form>
      </div>
    </>
  )
}
