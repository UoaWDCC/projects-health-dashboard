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

type PersonIdentity = {
  id: string
  provider: string
  externalId: string
  username: string | null
}

type Person = {
  id: string
  displayName: string
  identities: PersonIdentity[]
}

export default function CreateMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  // Extract projectId from the url
  const { id: projectId } = use(params)

  const [existingPeople, setExistingPeople] = useState<Person[]>([])
  const [selectedPersonId, setSelectedPersonId] = useState<string>('NEW')

  useEffect(() => {
    const loadPeople = async () => {
      try {
        const res = await fetch('/api/people')
        if (res.ok) {
          const data = await res.json()
          setExistingPeople(data)
        }
      } catch (e) {
        console.error('Failed to fetch people', e)
      }
    }
    loadPeople()
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    // If an existing person is selected, attach their personId explicitly
    if (selectedPersonId !== 'NEW') {
      formData.append('personId', selectedPersonId)
    }

    // Dynamically inject the correct URL
    const response = await fetch(`/api/project/${projectId}/members`, {
      method: 'POST',
      body: formData,
    })

    if (!response.ok) {
      const text = await response.text()
      try {
        const data = JSON.parse(text)
        const errorMessage = data?.error ?? data?.message ?? text
        alert('Failed to add member: ' + errorMessage)
      } catch (e) {
        console.error('Failed to add member', e)
        alert('Failed to add member: ' + text)
      }
      return
    }

    // Redirect back to the specific project view
    router.push(`/projects/${projectId}`)
  }

  const isExistingMember = selectedPersonId !== 'NEW'

  return (
    <main>
      <h1>Add New Project Member</h1>
      <form onSubmit={handleSubmit}>
        <label>
          Select Existing Person:
          <select
            style={{ border: '1px solid #ccc', marginLeft: '10px' }}
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            name="personIdSelector"
          >
            <option value="NEW">-- Create Brand New Person --</option>
            {existingPeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
                {person.identities && person.identities.length > 0
                  ? ` (${person.identities.map((i) => `${i.provider}: ${i.username || i.externalId}`).join(', ')})`
                  : ''}
              </option>
            ))}
          </select>
        </label>
        <br />
        <br />

        {isExistingMember ? (
          <div style={{ background: '#f5f5f5', padding: '10px', marginBottom: '20px' }}>
            <p style={{ color: 'gray', margin: 0 }}>
              You are assigning an existing person to this project.
              <br />
              Their existing name, photo, and identities will be preserved!
            </p>
          </div>
        ) : (
          <>
            <label>
              Full Name / Display Name:
              <input type="text" style={{ border: '1px solid #ccc' }} name="displayName" required />
            </label>
            <br />
            <br />
            <label>
              Discord Username/ID (Optional):
              <input type="text" style={{ border: '1px solid #ccc' }} name="discordId" />
            </label>
            <br />
            <br />
            <label>
              GitHub Username (Optional):
              <input type="text" style={{ border: '1px solid #ccc' }} name="githubId" />
            </label>
            <br />
            <br />
            <label>
              Profile Photo:
              <input
                type="text"
                style={{ border: '1px solid #ccc' }}
                name="imageUrl"
                placeholder="https://..."
              />
            </label>
            <br />
            <br />
          </>
        )}

        <button type="submit">Add Member</button>
      </form>
    </main>
  )
}
