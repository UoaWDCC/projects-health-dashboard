'use client'

import { useEffect, useState, use, FormEvent, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { IdentityProvider } from '@repo/db'
import GradientDivider from '@/components/dashboard/GradientDivider'
import AdminCard from '@/components/dashboard/AdminCard'
import { inputClass, labelClass, PROVIDER_COLORS } from '@/lib/admin/layout'
import ErrorMessage from '@/components/utils/ErrorMessage'

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

export default function EditMemberPage({
  params,
}: {
  params: Promise<{ slug: string; memberId: string }>
}) {
  const { slug, memberId } = use(params)
  const router = useRouter()

  const [person, setPerson] = useState<Person | null>(null)
  const [loading, setLoading] = useState(true)

  // ── Basic details edit ──
  const [isEditingPerson, setIsEditingPerson] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [forceCascade, setForceCascade] = useState(false)
  const [editPersonError, setEditPersonError] = useState<string | null>(null)

  // ── Identities ──
  const [isAddingIdentity, setIsAddingIdentity] = useState(false)
  const [newIdentityProvider, setNewIdentityProvider] = useState<IdentityProvider>('DISCORD')
  const [newIdentityUsername, setNewIdentityUsername] = useState('')
  const [addIdentityError, setAddIdentityError] = useState<string | null>(null)
  const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null)
  const [editIdentityUsername, setEditIdentityUsername] = useState('')
  const [editIdentityError, setEditIdentityError] = useState<string | null>(null)
  const [deleteIdentityError, setDeleteIdentityError] = useState<string | null>(null)

  // ── Membership Settings ──
  const [membershipDisplayName, setMembershipDisplayName] = useState('')
  const [membershipIsActive, setMembershipIsActive] = useState(true)
  const [membershipError, setMembershipError] = useState<string | null>(null)
  const [membershipSuccess, setMembershipSuccess] = useState(false)
  const [confirmUnlink, setConfirmUnlink] = useState(false)
  const [unlinkError, setUnlinkError] = useState<string | null>(null)

  // Fetch the membership first to get personId, then fetch the full person
  const fetchPerson = useCallback(async () => {
    setLoading(true)
    try {
      const memberRes = await fetch(`/api/project/${slug}/members/${memberId}`)
      if (!memberRes.ok) {
        console.error('Failed to load membership')
        setLoading(false)
        return
      }
      const memberData: ProjectMember = await memberRes.json()

      const personRes = await fetch(`/api/people/${memberData.personId}`)
      if (personRes.ok) {
        const data: Person = await personRes.json()
        setPerson(data)
        setEditDisplayName(data.displayName)
        setEditImageUrl(data.imageUrl || '')
        setForceCascade(false)
        const m = data.memberships.find((m: ProjectMember) => m.id === memberId)
        if (m) {
          setMembershipDisplayName(m.displayName ?? '')
          setMembershipIsActive(m.isActive)
        }
      } else {
        const data = await personRes.json().catch(() => ({}))
        console.error('Failed to load person:', data?.error ?? personRes.status)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [slug, memberId])

  useEffect(() => {
    fetchPerson()
  }, [fetchPerson])

  // ── Handlers ──

  const handleUpdatePerson = async (e: FormEvent) => {
    e.preventDefault()
    if (!person) return
    setEditPersonError(null)
    const res = await fetch(`/api/people/${person.id}`, {
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

  const handleAddIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (!person) return
    setAddIdentityError(null)
    const res = await fetch(`/api/people/${person.id}/identities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: newIdentityProvider, username: newIdentityUsername }),
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

  const handleUpdateIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (!person || !editingIdentityId) return
    setEditIdentityError(null)
    const res = await fetch(`/api/people/${person.id}/identities/${editingIdentityId}`, {
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
    if (!person || !confirm('Are you sure you want to delete this identity?')) return
    setDeleteIdentityError(null)
    const res = await fetch(`/api/people/${person.id}/identities/${identityId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      fetchPerson()
    } else {
      const data = await res.json().catch(() => ({}))
      setDeleteIdentityError(data?.error ?? 'Failed to delete identity.')
    }
  }

  const handleUpdateMembership = async (e: FormEvent) => {
    e.preventDefault()
    if (!person) return
    setMembershipError(null)
    const res = await fetch(`/api/people/${person.id}/memberships/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        displayName: membershipDisplayName.trim() || null,
        isActive: membershipIsActive,
      }),
    })
    if (res.ok) {
      setMembershipSuccess(true)
      setTimeout(() => setMembershipSuccess(false), 2000)
      fetchPerson()
    } else {
      const data = await res.json().catch(() => ({}))
      setMembershipError(data?.error ?? 'Failed to update membership.')
    }
  }

  const handleUnlink = async () => {
    if (!person) return
    setUnlinkError(null)
    const res = await fetch(`/api/people/${person.id}/memberships/${memberId}`, {
      method: 'DELETE',
    })
    if (res.ok) {
      router.push(`/projects/${slug}`)
    } else {
      const data = await res.json().catch(() => ({}))
      setUnlinkError(data?.error ?? 'Failed to unlink member.')
      setConfirmUnlink(false)
    }
  }

  // ── Render ──

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Loading profile...</p>
      </div>
    )

  if (!person)
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-mono text-sm text-wdcc-grey-light">Member not found.</p>
      </div>
    )

  // The membership that brought us here
  const currentMembership = person.memberships.find((m) => m.id === memberId)

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
          href={`/projects/${slug}`}
          className="inline-flex items-center gap-1.5 font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors"
        >
          ← {slug}
        </Link>

        {/* ── Basic Details ── */}
        <AdminCard>
          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
                Basic Details
              </p>
              <p className="font-mono text-[11px] text-wdcc-grey-light">/ people / {person.id}</p>
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
                  {currentMembership && (
                    <span className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey-light">
                        Joined {slug}
                      </span>
                      <span className="font-mono text-[11px] text-wdcc-grey">
                        {new Date(currentMembership.joinedAt).toLocaleDateString('en-NZ', {
                          dateStyle: 'medium',
                        })}
                      </span>
                    </span>
                  )}
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
                    onChange={(e) => setNewIdentityUsername(e.target.value)}
                    placeholder="e.g. janesmith"
                    required
                    className={inputClass}
                  />
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

          {deleteIdentityError && (
            <div className="mb-3">
              <ErrorMessage message={deleteIdentityError} />
            </div>
          )}

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

        {/* ── Membership Settings ── */}
        <AdminCard>
          <p className="font-extrabold text-wdcc-oshan uppercase tracking-widest text-lg mb-1">
            Membership Settings
          </p>
          <p className="font-mono text-[11px] text-wdcc-grey-light mb-6">
            / projects / {slug} / members / {memberId}
          </p>
          <GradientDivider />

          {/* Read-only membership meta */}
          {currentMembership && (
            <div className="flex gap-3 mt-6 mb-6 flex-wrap">
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
                  {new Date(currentMembership.joinedAt).toLocaleDateString('en-NZ', {
                    dateStyle: 'medium',
                  })}
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 ${currentMembership.isActive ? 'bg-wdcc-mint' : 'bg-wdcc-grey-light/10'}`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${currentMembership.isActive ? 'bg-green-500' : 'bg-wdcc-grey-light'}`}
                />
                <span
                  className={`font-mono text-[10px] uppercase tracking-widest font-semibold ${currentMembership.isActive ? 'text-green-700' : 'text-wdcc-grey-light'}`}
                >
                  {currentMembership.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>
          )}

          <form onSubmit={handleUpdateMembership} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Display name override</label>
              <input
                value={membershipDisplayName}
                onChange={(e) => setMembershipDisplayName(e.target.value)}
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
                checked={membershipIsActive}
                onChange={(e) => setMembershipIsActive(e.target.checked)}
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

            {membershipError && <ErrorMessage message={membershipError} />}
            {membershipSuccess && (
              <div className="flex items-center gap-2 bg-wdcc-mint border border-green-200 rounded-xl px-4 py-3 font-mono text-xs text-green-700">
                ✓ &nbsp;Membership updated.
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-wdcc-grey-light/20">
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
          </form>
        </AdminCard>

        {/* ── Danger Zone ── */}
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
                <span className="text-wdcc-oshan">
                  {currentMembership?.displayName ?? person.displayName}
                </span>{' '}
                from <span className="text-wdcc-oshan">{slug}</span>. If this is their only project,
                their person record and identities will also be deleted.
              </p>
              {unlinkError && (
                <div className="mt-3">
                  <ErrorMessage message={unlinkError} />
                </div>
              )}
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
