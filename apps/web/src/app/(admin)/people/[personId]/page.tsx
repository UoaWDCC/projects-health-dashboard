'use client'

import { useEffect, useState, use, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { IdentityProvider } from '@repo/db'
import GradientDivider from '@/components/dashboard/GradientDivider'
import AdminCard from '@/components/dashboard/AdminCard'
import { inputClass, inputErrorClass, labelClass, PROVIDER_COLORS } from '@/lib/admin/layout'
import ErrorMessage from '@/components/utils/ErrorMessage'
import FieldError from '@/components/utils/FieldError'
import { z } from 'zod'
import { updatePersonSchema, addIdentitySchema } from '@/lib/schemas/admin'

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

export default function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = use(params)

  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)

  const [isEditingPerson, setIsEditingPerson] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [forceCascade, setForceCascade] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)

  const [isAddingIdentity, setIsAddingIdentity] = useState(false)
  const [newIdentityProvider, setNewIdentityProvider] = useState<IdentityProvider>('DISCORD')
  const [newIdentityUsername, setNewIdentityUsername] = useState('')
  const [addIdentityError, setAddIdentityError] = useState<string | null>(null)
  const [addIdentityFieldErrors, setAddIdentityFieldErrors] = useState<Record<string, string>>({})

  const [editPersonFieldErrors, setEditPersonFieldErrors] = useState<Record<string, string>>({})

  const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null)
  const [editIdentityUsername, setEditIdentityUsername] = useState('')
  const [editIdentityError, setEditIdentityError] = useState<string | null>(null)

  const [deleteIdentityError, setDeleteIdentityError] = useState<string | null>(null)

  const [editingMembershipId, setEditingMembershipId] = useState<string | null>(null)
  const [editMembershipName, setEditMembershipName] = useState('')
  const [editMembershipActive, setEditMembershipActive] = useState(true)
  const [editMembershipError, setEditMembershipError] = useState<string | null>(null)

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
      } else {
        const data = await res.json().catch(() => ({}))
        console.error('Failed to load person:', data?.error ?? res.status)
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

  const handleUpdatePerson = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setEditPersonError(null)

    const imageUrlValue = editImageUrl.trim() || null
    const validation = updatePersonSchema.safeParse({
      displayName: editDisplayName.trim(),
      imageUrl: imageUrlValue,
      forceCascade,
    })
    if (!validation.success) {
      const errors = z.flattenError(validation.error).fieldErrors
      setEditPersonFieldErrors({
        displayName: errors.displayName?.[0] ?? '',
        imageUrl: errors.imageUrl?.[0] ?? '',
      })
      return
    }
    setEditPersonFieldErrors({})

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
    } else {
      const data = await res.json().catch(() => ({}))
      setEditPersonError(data?.error ?? 'Failed to update person.')
    }
  }

  const handleAddIdentity = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    setAddIdentityError(null)

    const validation = addIdentitySchema.safeParse({
      provider: newIdentityProvider,
      username: newIdentityUsername,
    })
    if (!validation.success) {
      const errors = z.flattenError(validation.error).fieldErrors
      setAddIdentityFieldErrors({ username: errors.username?.[0] ?? '' })
      return
    }
    setAddIdentityFieldErrors({})

    const res = await fetch(`/api/people/${personId}/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: newIdentityProvider,
        username: newIdentityUsername,
      }),
    })
    if (res.ok) {
      setIsAddingIdentity(false)
      setNewIdentityUsername('')
      fetchPerson()
    } else {
      const data = await res.json().catch(() => ({}))
      setAddIdentityError(data?.error ?? 'Failed to add identity.')
    }
  }

  const handleUpdateIdentity = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!editingIdentityId) return
    setEditIdentityError(null)

    const res = await fetch(`/api/people/${personId}/identities/${editingIdentityId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: editIdentityUsername }),
    })
    if (res.ok) {
      setEditingIdentityId(null)
      fetchPerson()
    } else {
      const data = await res.json().catch(() => ({}))
      setEditIdentityError(data?.error ?? 'Failed to update identity.')
    }
  }

  const handleDeleteIdentity = async (identityId: string) => {
    if (!confirm('Are you sure you want to delete this identity?')) return
    setDeleteIdentityError(null)
    const res = await fetch(`/api/people/${personId}/identities/${identityId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      fetchPerson()
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteIdentityError(data?.error ?? 'Failed to delete identity.')
    }
  }

  const handleUpdateMembership = async (e: React.SyntheticEvent) => {
    e.preventDefault()
    if (!editingMembershipId) return
    setEditMembershipError(null)
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
    } else {
      const data = await res.json().catch(() => ({}))
      setEditMembershipError(data?.error ?? 'Failed to update membership.')
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
        <AdminCard>
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
                    onChange={(e) => {
                      setEditDisplayName(e.target.value)
                      setEditPersonFieldErrors((p) => ({ ...p, displayName: '' }))
                    }}
                    className={editPersonFieldErrors.displayName ? inputErrorClass : inputClass}
                  />
                  <FieldError message={editPersonFieldErrors.displayName} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Profile photo URL</label>
                  <input
                    type="url"
                    value={editImageUrl}
                    onChange={(e) => {
                      setEditImageUrl(e.target.value)
                      setEditPersonFieldErrors((p) => ({ ...p, imageUrl: '' }))
                    }}
                    placeholder="https://..."
                    className={editPersonFieldErrors.imageUrl ? inputErrorClass : inputClass}
                  />
                  <FieldError message={editPersonFieldErrors.imageUrl} />
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
              {editPersonError && <ErrorMessage message={editPersonError} />}
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
        </AdminCard>

        {/* ── Connected Identities ── */}
        <AdminCard>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <label className={labelClass}>
                    Username <span className="text-wdcc-kelvin">*</span>
                  </label>
                  <input
                    value={newIdentityUsername}
                    onChange={(e) => {
                      setNewIdentityUsername(e.target.value)
                      setAddIdentityFieldErrors((p) => ({ ...p, username: '' }))
                    }}
                    placeholder="e.g. janesmith"
                    className={addIdentityFieldErrors.username ? inputErrorClass : inputClass}
                  />
                  <FieldError message={addIdentityFieldErrors.username} />
                </div>
              </div>
              {addIdentityError && <ErrorMessage message={addIdentityError} />}
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

          {/* Delete identity error */}
          {deleteIdentityError && (
            <div className="mb-3">
              <ErrorMessage message={deleteIdentityError} />
            </div>
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
                      <div className="flex flex-col gap-1.5">
                        <label className={labelClass}>Username</label>
                        <input
                          value={editIdentityUsername}
                          onChange={(e) => setEditIdentityUsername(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      {editIdentityError && <ErrorMessage message={editIdentityError} />}
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
                            setEditIdentityError(null)
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
        </AdminCard>

        {/* ── Project Memberships ── */}
        <AdminCard>
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
                    {editMembershipError && <ErrorMessage message={editMembershipError} />}
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
                        setEditMembershipError(null)
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
        </AdminCard>
      </div>
    </>
  )
}
