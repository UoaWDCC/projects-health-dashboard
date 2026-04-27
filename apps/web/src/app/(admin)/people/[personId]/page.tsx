'use client'

import { useEffect, useState, use, FormEvent, useCallback } from 'react'
import Link from 'next/link'
import Image from 'next/image'

type IdentityProvider = 'GITHUB' | 'DISCORD'

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

  // Person Edit State
  const [isEditingPerson, setIsEditingPerson] = useState(false)
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [forceCascade, setForceCascade] = useState(false)

  // Identity Add State
  const [isAddingIdentity, setIsAddingIdentity] = useState(false)
  const [newIdentityProvider, setNewIdentityProvider] = useState<IdentityProvider>('DISCORD')
  const [newIdentityUsername, setNewIdentityUsername] = useState('')
  const [newIdentityExternalId, setNewIdentityExternalId] = useState('')

  // Identity Edit State
  const [editingIdentityId, setEditingIdentityId] = useState<string | null>(null)
  const [editIdentityUsername, setEditIdentityUsername] = useState('')
  const [editIdentityExternalId, setEditIdentityExternalId] = useState('')

  // Membership Edit State
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
      } else {
        alert('Failed to load person data.')
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
    try {
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
        fetchPerson() // Refetch to sync state
      } else {
        alert('Failed to update person.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleAddIdentity = async (e: FormEvent) => {
    e.preventDefault()
    try {
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
        fetchPerson() // Refetch to sync state
      } else {
        const error = await res.json()
        alert('Failed to add identity: ' + (error.error || 'Unknown error'))
      }
    } catch (err) {
      console.error(err)
    }
  }

  const startEditingIdentity = (identity: PersonIdentity) => {
    setEditingIdentityId(identity.id)
    setEditIdentityUsername(identity.username || '')
    setEditIdentityExternalId(identity.externalId)
  }

  const handleUpdateIdentity = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingIdentityId) return
    try {
      const res = await fetch(`/api/people/${personId}/identities/${editingIdentityId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          externalId: editIdentityExternalId,
          username: editIdentityUsername,
        }),
      })
      if (res.ok) {
        setEditingIdentityId(null)
        fetchPerson() // Refetch to sync state
      } else {
        alert('Failed to update identity.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteIdentity = async (identityId: string) => {
    if (!confirm('Are you sure you want to delete this identity?')) return
    try {
      const res = await fetch(`/api/people/${personId}/identities/${identityId}`, {
        method: 'DELETE',
      })
      if (res.ok) fetchPerson()
    } catch (err) {
      console.error(err)
    }
  }

  const startEditingMembership = (m: ProjectMember) => {
    setEditingMembershipId(m.id)
    setEditMembershipName(m.displayName || '')
    setEditMembershipActive(m.isActive)
  }

  const handleUpdateMembership = async (e: FormEvent) => {
    e.preventDefault()
    if (!editingMembershipId) return
    try {
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
        fetchPerson() // Refetch to sync state
      } else {
        alert('Failed to update membership.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) return <div style={{ padding: '20px' }}>Loading Person Profile...</div>
  if (!person) return <div style={{ padding: '20px' }}>Person not found.</div>

  return (
    <main style={{ padding: '20px', maxWidth: '800px' }}>
      <h1>Person Profile</h1>

      {/* 1. Basic Info Section */}
      <section style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Basic Details</h2>
          <button onClick={() => setIsEditingPerson(!isEditingPerson)}>
            {isEditingPerson ? 'Cancel' : 'Edit'}
          </button>
        </div>
        {isEditingPerson ? (
          <form onSubmit={handleUpdatePerson} style={{ marginTop: '10px' }}>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Display Name:
                <input
                  value={editDisplayName}
                  onChange={(e) => setEditDisplayName(e.target.value)}
                  style={{ marginLeft: '10px', border: '1px solid #ccc' }}
                  required
                />
              </label>
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label>
                Profile Photo URL:
                <input
                  value={editImageUrl}
                  onChange={(e) => setEditImageUrl(e.target.value)}
                  placeholder="https://..."
                  style={{ marginLeft: '10px', border: '1px solid #ccc', width: '300px' }}
                />
              </label>
            </div>
            <div style={{ marginBottom: '15px' }}>
              <label>
                <input
                  type="checkbox"
                  checked={forceCascade}
                  onChange={(e) => setForceCascade(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                <strong>Force Cascade Name Change?</strong> (Checking this will overwrite any custom
                Project-Specific nicknames they have set across all projects. If unchecked, the new
                name will only cascade to memberships that have not been explicitly modified.)
              </label>
            </div>
            <button type="submit">Save Changes</button>
          </form>
        ) : (
          <div style={{ marginTop: '10px', display: 'flex', gap: '20px' }}>
            {person.imageUrl && (
              <Image
                src={person.imageUrl}
                alt="Profile"
                width={100}
                height={100}
                style={{ width: '100px', height: '100px', objectFit: 'cover', borderRadius: '50%' }}
              />
            )}
            <div>
              <p>
                <strong>Name:</strong> {person.displayName}
              </p>
              <p>
                <strong>Database ID:</strong> {person.id}
              </p>
              <p>Added On: {new Date(person.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        )}
      </section>

      {/* 2. Identities Section */}
      <section style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2>Connected Identities</h2>
          <button onClick={() => setIsAddingIdentity(!isAddingIdentity)}>
            {isAddingIdentity ? 'Cancel' : 'Add Identity'}
          </button>
        </div>

        {isAddingIdentity && (
          <div
            style={{
              padding: '15px',
              marginTop: '15px',
              marginBottom: '15px',
              border: '1px solid #ccc',
            }}
          >
            <form onSubmit={handleAddIdentity}>
              <div style={{ marginBottom: '10px' }}>
                <label>
                  Platform:
                  <select
                    value={newIdentityProvider}
                    onChange={(e) => setNewIdentityProvider(e.target.value as IdentityProvider)}
                    style={{ marginLeft: '5px', marginRight: '15px', border: '1px solid #ccc' }}
                  >
                    <option value="DISCORD">Discord</option>
                    <option value="GITHUB">GitHub</option>
                  </select>
                </label>
                <label>
                  Username (Visual):
                  <input
                    value={newIdentityUsername}
                    onChange={(e) => setNewIdentityUsername(e.target.value)}
                    style={{ marginLeft: '5px', marginRight: '15px', border: '1px solid #ccc' }}
                  />
                </label>
              </div>
              <div style={{ marginBottom: '10px' }}>
                <label>
                  External ID (Required ID/Snowflake):
                  <input
                    value={newIdentityExternalId}
                    onChange={(e) => setNewIdentityExternalId(e.target.value)}
                    style={{ marginLeft: '5px', marginRight: '15px', border: '1px solid #ccc' }}
                    required
                  />
                </label>
              </div>
              <button type="submit">Save Identity</button>
            </form>
          </div>
        )}

        <ul style={{ marginTop: '15px' }}>
          {person.identities.map((identity) => (
            <li key={identity.id} style={{ marginBottom: '10px' }}>
              {editingIdentityId === identity.id ? (
                <form
                  onSubmit={handleUpdateIdentity}
                  style={{ display: 'inline', padding: '5px', border: '1px solid #ccc' }}
                >
                  <strong>{identity.provider}</strong>
                  <input
                    value={editIdentityUsername}
                    onChange={(e) => setEditIdentityUsername(e.target.value)}
                    placeholder="Username"
                    style={{ marginLeft: '10px', border: '1px solid #ccc' }}
                  />
                  <input
                    value={editIdentityExternalId}
                    onChange={(e) => setEditIdentityExternalId(e.target.value)}
                    placeholder="External ID"
                    style={{ marginLeft: '10px', border: '1px solid #ccc' }}
                    required
                  />
                  <button type="submit" style={{ marginLeft: '10px' }}>
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingIdentityId(null)}
                    style={{ marginLeft: '5px' }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <>
                  <strong>{identity.provider}</strong>: {identity.username || identity.externalId}
                  <span style={{ marginLeft: '10px' }}>({identity.externalId})</span>
                  <button
                    onClick={() => startEditingIdentity(identity)}
                    style={{ marginLeft: '15px', textDecoration: 'underline' }}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteIdentity(identity.id)}
                    style={{ marginLeft: '10px', textDecoration: 'underline' }}
                  >
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
          {person.identities.length === 0 && <p>No identities connected.</p>}
        </ul>
      </section>

      {/* 3. Project Memberships Section */}
      <section style={{ border: '1px solid #ccc', padding: '15px' }}>
        <h2>Project Memberships</h2>
        <ul style={{ marginTop: '15px', paddingLeft: 0, listStyle: 'none' }}>
          {person.memberships.map((membership) => (
            <li
              key={membership.id}
              style={{
                marginBottom: '15px',
                background: '#fff',
                padding: '15px',
                border: '1px solid #ccc',
              }}
            >
              {editingMembershipId === membership.id ? (
                <form onSubmit={handleUpdateMembership}>
                  <label>
                    <input
                      type="checkbox"
                      checked={editMembershipActive}
                      onChange={(e) => setEditMembershipActive(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <strong>Is Active Member?</strong> (Uncheck to softly remove from project)
                  </label>
                  <br />
                  <br />
                  <label>
                    Display Name in Project Override:
                    <input
                      value={editMembershipName}
                      onChange={(e) => setEditMembershipName(e.target.value)}
                      placeholder={person.displayName}
                      style={{ marginLeft: '10px', border: '1px solid #ccc', padding: '2px 5px' }}
                    />
                  </label>
                  <br />
                  <br />
                  <button type="submit">Save Membership</button>
                  <button
                    type="button"
                    onClick={() => setEditingMembershipId(null)}
                    style={{ marginLeft: '10px' }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <div>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Project:</strong>{' '}
                    <Link href={`/projects/${membership.project.slug}`}>
                      {membership.project?.name || membership.projectId}
                    </Link>
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Display Name in Project:</strong>{' '}
                    {membership.displayName || (
                      <span style={{ color: 'gray' }}>{person.displayName} (Inherited)</span>
                    )}
                  </p>
                  <p style={{ margin: '0 0 8px 0' }}>
                    <strong>Status:</strong>{' '}
                    {membership.isActive ? 'Active' : 'Inactive (Soft Deleted)'}
                  </p>
                  <button
                    onClick={() => startEditingMembership(membership)}
                    style={{ marginTop: '5px' }}
                  >
                    Edit Membership Settings
                  </button>
                </div>
              )}
            </li>
          ))}
          {person.memberships.length === 0 && (
            <p style={{ color: 'gray' }}>Not an active member of any projects.</p>
          )}
        </ul>
      </section>
    </main>
  )
}
