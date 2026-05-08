'use client'

import { useEffect, useState, use, FormEvent, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IdentityProvider } from '@repo/db'

type PersonIdentity = {
  id: string
  personId: string
  provider: IdentityProvider
  externalId: string
  username: string | null
}

type Project = {
  id: string
  name: string
  slug: string
}

type ProjectMember = {
  id: string
  projectId: string
  personId: string
  displayName: string | null
  isActive: boolean
  joinedAt: string
  project: Project
}

type Person = {
  id: string
  displayName: string
  imageUrl: string | null
  createdAt: string
  identities: PersonIdentity[]
  memberships: ProjectMember[]
}

const BORDER_DEFAULT =
  'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4)) border-box'
const BORDER_HOVER =
  'linear-gradient(white, white) padding-box, linear-gradient(to right, rgba(255,176,95,1), rgba(227,51,163,1), rgba(7,124,241,1)) border-box'

const inputClass =
  'font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light'
const labelClass = 'font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold'

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  GITHUB: { bg: 'bg-wdcc-oshan/10', text: 'text-wdcc-oshan' },
  DISCORD: { bg: 'bg-wdcc-kelvin/10', text: 'text-wdcc-kelvin' },
}

export default function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = use(params)

  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)

  const [isEditingPerson, setIsEditingPerson] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [forceCascade, setForceCascade] = useState(false)

  const [isAddingIdentity, setIsAddingIdentity] = useState(false)
  const [newIdentityProvider, setNewIdentityProvider] = useState<IdentityProvider>('DISCORD')
  const [newIdentityUsername, setNewIdentityUsername] = useState('')
  const [newIdentityExternalId, setNewIdentityExternalId] = useState('')

  const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null)
  const [editIdentityUsername, setEditIdentityUsername] = useState('')
  const [editIdentityExternalId, setEditIdentityExternalId] = useState('')

  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null)
  const [editMembershipName, setEditMembershipName] = useState('')
  const [editMembershipActive, setEditMembershipActive] = useState(true)

  const fetchPerson = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/people/${personId}`)
      if (res.ok) {
        const data = await res.json()
        setPerson(data)
        setEditDisplayName(data.displayName)
        setEditImageUrl(data.imageUrl || '')
        setForceCascade(false)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [personId])

  useEffect(() => {
    fetchPerson()
  }, [fetchPerson])

  const handleUpdatePerson = async (e: FormEvent) => {
    e.preventDefault()
    const res = await fetch(`/api/people/${personId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: editDisplayName,
        imageUrl: editImageUrl.trim() || null,
        forceCascade,
      }),
    })
    if (res.ok) {
      setIsEditingPerson(false)
      fetchPerson()
    }
  }

  const handleAddIdentity = async (e: FormEvent) => {
    e.preventDefault()
    const res = await fetch(`/api/people/${personId}/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: newIdentityProvider,
        externalId: newIdentityExternalId,
        username: newIdentityUsername,
      }),
    })
    if (res.ok) {
      setIsAddingIdentity(false)
      setNewIdentityExternalId('')
      setNewIdentityUsername('')
      fetchPerson()
    }
  }

  const handleUpdateIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingIdentityId) return
    const res = await fetch(`/api/people/${personId}/identities/${editingIdentityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalId: editIdentityExternalId, username: editIdentityUsername }),
    })
    if (res.ok) {
      setEditingIdentityId(null)
      fetchPerson()
    }
  }

  const handleDeleteIdentity = async (identityId: string) => {
    if (!confirm('Are you sure you want to delete this identity?')) return
    const res = await fetch(`/api/people/${personId}/identities/${identityId}`, {
      method: 'DELETE',
    })
    if (res.ok) fetchPerson()
  }

  const handleUpdateMembership = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMembershipId) return
    const res = await fetch(`/api/people/${personId}/memberships/${editingMembershipId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: editMembershipName.trim() || null,
        isActive: editMembershipActive,
      }),
    })
    if (res.ok) {
      setEditingMembershipId(null)
      fetchPerson()
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Loading profile...</p>
      </div>
    )

  if (!person)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Person not found.</p>
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
            people / {personId}
          </p>
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            {person.displayName}
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            View and manage this person&apos;s profile, connected identities, and project
            memberships.
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
          href="/admin-dashboard"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors"
        >
          ← admin-dashboard
        </Link>

        {/* ── Basic Details ── */}
        <Card>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
                Basic Details
              </p>
              <p className="font-mono text-[11px] text-wdcc-grey-light">/ people / {personId}</p>
            </div>
            <button
              onClick={() => setIsEditingPerson(!isEditingPerson)}
              className="font-mono text-xs text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-4 py-2 transition-all shrink-0"
            >
              {isEditingPerson ? 'Cancel' : 'Edit'}
            </button>
          </div>
          <GradientDivider />

          {isEditingPerson ? (
            <form onSubmit={handleUpdatePerson} className="flex flex-col gap-5 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>
                    Display name <span className="text-wdcc-kelvin">*</span>
                  </label>
                  <input
                    value={editDisplayName}
                    onChange={(e) => setEditDisplayName(e.target.value)}
                    required
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Profile photo URL</label>
                  <input
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://..."
                    className={inputClass}
                  />
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceCascade}
                  onChange={(e) => setForceCascade(e.target.checked)}
                  className="mt-0.5 accent-[#077CF1]"
                />
                <div>
                  <p className="font-mono text-sm font-semibold text-wdcc-oshan">
                    Force cascade name change
                  </p>
                  <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">
                    Overwrites any custom project-specific nicknames. If unchecked, only unmodified
                    memberships are updated.
                  </p>
                </div>
              </label>
              <div className="flex justify-end gap-3 pt-4 border-t border-wdcc-grey-light/20">
                <button
                  type="button"
                  onClick={() => setIsEditingPerson(false)}
                  className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2.5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-blue rounded-xl px-6 py-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(7,124,241,0.25)]"
                >
                  <span>→</span> Save changes
                </button>
              </div>
            </form>
          ) : (
            <div className="flex items-center gap-5 mt-6">
              <div className="w-[72px] h-[72px] rounded-full bg-wdcc-purple overflow-hidden shrink-0 flex items-center justify-center">
                {person.imageUrl ? (
                  <Image
                    src={person.imageUrl}
                    alt="Profile"
                    width={72}
                    height={72}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="font-mono font-bold text-wdcc-kelvin text-xl">
                    {person.displayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1.5 min-w-0">
                <h2 className="text-[18px] font-extrabold text-wdcc-oshan leading-tight truncate">
                  {person.displayName}
                </h2>
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey-light">
                      ID
                    </span>
                    <span className="font-mono text-[11px] text-wdcc-grey truncate">
                      {person.id}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey-light">
                      Added
                    </span>
                    <span className="font-mono text-[11px] text-wdcc-grey">
                      {new Date(person.createdAt).toLocaleDateString('en-NZ', {
                        dateStyle: 'medium',
                      })}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* ── Connected Identities ── */}
        <Card>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
                Connected Identities
              </p>
              <p className="font-mono text-[11px] text-wdcc-grey-light">
                {person.identities.length} connected
              </p>
            </div>
            <button
              onClick={() => setIsAddingIdentity(!isAddingIdentity)}
              className="flex items-center gap-1.5 font-mono text-xs text-wdcc-blue bg-wdcc-blue/10 hover:bg-wdcc-blue/20 border-[1.5px] border-wdcc-blue/30 rounded-xl px-4 py-2 transition-all shrink-0"
            >
              {isAddingIdentity ? 'Cancel' : '+ Add identity'}
            </button>
          </div>
          <GradientDivider />

          {/* Add identity form */}
          {isAddingIdentity && (
            <form
              onSubmit={handleAddIdentity}
              className="mt-6 flex flex-col gap-4 bg-wdcc-blue/5 border-[1.5px] border-wdcc-blue/20 rounded-xl p-4 mb-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Platform</label>
                  <select
                    value={newIdentityProvider}
                    onChange={(e) => setNewIdentityProvider(e.target.value as IdentityProvider)}
                    className={inputClass}
                  >
                    <option value="DISCORD">Discord</option>
                    <option value="GITHUB">GitHub</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Username</label>
                  <input
                    value={newIdentityUsername}
                    onChange={(e) => setNewIdentityUsername(e.target.value)}
                    placeholder="e.g. janesmith"
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>
                    External ID <span className="text-wdcc-kelvin">*</span>
                  </label>
                  <input
                    value={newIdentityExternalId}
                    onChange={(e) => setNewIdentityExternalId(e.target.value)}
                    placeholder="Snowflake / GitHub ID"
                    required
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-blue rounded-xl px-6 py-2.5 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(7,124,241,0.25)]"
                >
                  <span>→</span> Save identity
                </button>
              </div>
            </form>
          )}

          {/* Identity list */}
          <ul className="flex flex-col gap-3 mt-6">
            {person.identities.length === 0 && (
              <p className="font-mono text-sm text-wdcc-grey-light">No identities connected.</p>
            )}
            {person.identities.map((identity) => {
              const colors = PROVIDER_COLORS[identity.provider] ?? {
                bg: 'bg-wdcc-grey-light/10',
                text: 'text-wdcc-grey',
              }
              return (
                <li key={identity.id}>
                  {editingIdentityId === identity.id ? (
                    <form
                      onSubmit={handleUpdateIdentity}
                      className="flex flex-col gap-4 bg-wdcc-blue/5 border-[1.5px] border-wdcc-blue/20 rounded-xl p-4"
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className={labelClass}>Username</label>
                          <input
                            value={editIdentityUsername}
                            onChange={(e) => setEditIdentityUsername(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className={labelClass}>
                            External ID <span className="text-wdcc-kelvin">*</span>
                          </label>
                          <input
                            value={editIdentityExternalId}
                            onChange={(e) => setEditIdentityExternalId(e.target.value)}
                            required
                            className={inputClass}
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setEditingIdentityId(null)}
                          className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2 transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-blue rounded-xl px-5 py-2 transition-all duration-150"
                        >
                          <span>→</span> Save
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="flex items-center justify-between gap-3 bg-wdcc-grey-light/5 border-[1.5px] border-wdcc-grey-light/15 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`shrink-0 font-mono text-[10px] uppercase tracking-widest font-semibold px-2.5 py-1.5 rounded-lg ${colors.bg} ${colors.text}`}
                        >
                          {identity.provider}
                        </span>
                        <span className="font-mono text-sm text-wdcc-oshan truncate">
                          {identity.username ?? identity.externalId}
                        </span>
                        <span className="font-mono text-[11px] text-wdcc-grey-light truncate hidden sm:block">
                          {identity.externalId}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setEditingIdentityId(identity.id)
                            setEditIdentityUsername(identity.username || '')
                            setEditIdentityExternalId(identity.externalId)
                          }}
                          className="font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors px-2 py-1"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteIdentity(identity.id)}
                          className="font-mono text-xs text-wdcc-grey-light hover:text-wdcc-kelvin transition-colors px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>

        {/* ── Project Memberships ── */}
        <Card>
          <div className="mb-6">
            <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
              Project Memberships
            </p>
            <p className="font-mono text-[11px] text-wdcc-grey-light">
              {person.memberships.length} membership{person.memberships.length !== 1 ? 's' : ''}
            </p>
          </div>
          <GradientDivider />

          <ul className="flex flex-col gap-3 mt-6">
            {person.memberships.length === 0 && (
              <p className="font-mono text-sm text-wdcc-grey-light">
                Not a member of any projects.
              </p>
            )}
            {person.memberships.map((membership) => (
              <li key={membership.id}>
                {editingMembershipId === membership.id ? (
                  <form
                    onSubmit={handleUpdateMembership}
                    className="flex flex-col gap-4 bg-wdcc-blue/5 border-[1.5px] border-wdcc-blue/20 rounded-xl p-4"
                  >
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass}>Display name override</label>
                      <input
                        value={editMembershipName}
                        onChange={(e) => setEditMembershipName(e.target.value)}
                        placeholder={person.displayName}
                        className={inputClass}
                      />
                      <p className="font-mono text-[11px] text-wdcc-grey-light">
                        Leave blank to inherit the global display name.
                      </p>
                    </div>
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editMembershipActive}
                        onChange={(e) => setEditMembershipActive(e.target.checked)}
                        className="mt-0.5 accent-[#077CF1]"
                      />
                      <div>
                        <p className="font-mono text-sm font-semibold text-wdcc-oshan">
                          Active member
                        </p>
                        <p className="font-mono text-[11px] text-wdcc-grey-light mt-0.5">
                          Uncheck to softly remove from this project.
                        </p>
                      </div>
                    </label>
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setEditingMembershipId(null)}
                        className="font-mono text-sm text-wdcc-grey-light border-[1.5px] border-wdcc-grey-light/30 hover:border-wdcc-grey-light rounded-xl px-5 py-2 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex items-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-blue rounded-xl px-5 py-2 transition-all duration-150"
                      >
                        <span>→</span> Save
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-3 bg-wdcc-grey-light/5 border-[1.5px] border-wdcc-grey-light/15 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0 flex-wrap">
                      <span
                        className={`shrink-0 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg font-semibold ${membership.isActive ? 'bg-wdcc-mint text-green-700' : 'bg-wdcc-grey-light/10 text-wdcc-grey-light'}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${membership.isActive ? 'bg-green-500' : 'bg-wdcc-grey-light'}`}
                        />
                        {membership.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <Link
                        href={`/projects/${membership.project.slug}`}
                        className="font-mono text-sm font-semibold text-wdcc-oshan hover:text-wdcc-blue transition-colors truncate"
                      >
                        {membership.project.name}
                      </Link>
                      {membership.displayName && (
                        <span className="font-mono text-[11px] text-wdcc-grey-light truncate hidden sm:block">
                          as {membership.displayName}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setEditingMembershipId(membership.id)
                        setEditMembershipName(membership.displayName || '')
                        setEditMembershipActive(membership.isActive)
                      }}
                      className="font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors px-2 py-1 shrink-0"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/* ─── Helpers ─── */

function Card({ children }: { children: React.ReactNode }) {
  return (
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
      {children}
    </div>
  )
}

function GradientDivider() {
  return (
    <div
      className="h-px mb-6"
      style={{
        background:
          'linear-gradient(to right, rgba(255,176,95,0.4), rgba(227,51,163,0.4), rgba(7,124,241,0.4))',
      }}
    />
  )
}
