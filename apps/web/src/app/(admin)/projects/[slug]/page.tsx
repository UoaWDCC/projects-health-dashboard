'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { IdentityProvider } from '@repo/db'

type PersonIdentity = {
  id: string
  personId: string
  provider: IdentityProvider
  externalId: string
  username: string | null
}

type Person = {
  id: string
  displayName: string
  imageUrl: string | null
  createdAt: string
  identities: PersonIdentity[]
}

type ProjectMember = {
  id: string
  projectId: string
  personId: string
  displayName: string | null
  isActive: boolean
  joinedAt: string
  person: Person
}

const fetchMembers = async (slug: string): Promise<ProjectMember[]> => {
  try {
    const response = await fetch(`/api/project/${slug}/members`)
    if (!response.ok) {
      throw new Error('Failed to fetch members')
    }
    return await response.json()
  } catch (error) {
    console.error('Error fetching members:', error)
    return []
  }
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  // 1. Unwrap the Next.js 15 Async Params using the React `use` hook in a Client Component
  const { slug } = use(params)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const data = await fetchMembers(slug)
      setMembers(data)
    }

    load()
  }, [slug])

  return (
    <div>
      <h1>Project Details for: {slug}</h1>

      <h2>Active Members ({members.length})</h2>
      <ul>
        {members.map((member) => (
          <li key={member.id}>
            <strong>
              <Link href={`/people/${member.personId}`}>{member.person.displayName}</Link>
            </strong>
            {member.person.identities.map((identity) => (
              <span
                key={identity.id}
                style={{ marginLeft: '10px', fontSize: '0.9em', color: 'gray' }}
              >
                [{identity.provider}: {identity.username || identity.externalId}]
              </span>
            ))}
          </li>
        ))}
      </ul>

      <button onClick={() => router.push(`/projects/${slug}/members/new`)}>
        Add New Member (Button)
      </button>
    </div>
  )
}
