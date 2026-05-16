'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { IdentityProvider } from '@repo/db'
import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'

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
    if (!response.ok) throw new Error('Failed to fetch members')
    return await response.json()
  } catch (error) {
    console.error('Error fetching members:', error)
    return []
  }
}

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
  GITHUB: { bg: 'bg-wdcc-oshan/10', text: 'text-wdcc-oshan' },
  DISCORD: { bg: 'bg-wdcc-kelvin/10', text: 'text-wdcc-kelvin' },
}

export default function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetchMembers(slug).then((data) => {
      setMembers(data)
      setLoading(false)
    })
  }, [slug])

  return (
    <>
      {/* Header */}
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <p className="font-mono text-[11px] uppercase tracking-widest text-wdcc-grey-light">
            projects / {slug}
          </p>
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            Members
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            View and manage all members of this project. Click a member to edit their profile and
            settings.
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
        {/* Toolbar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              href="/admin-dashboard"
              className="font-mono text-xs text-wdcc-grey-light hover:text-wdcc-blue transition-colors"
            >
              ← admin-dashboard
            </Link>
            <span className="text-wdcc-grey-light/40 font-mono text-xs">/</span>
            <p className="font-mono text-sm text-wdcc-grey-light">
              {loading ? '—' : members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => router.push(`/projects/${slug}/members/new`)}
            className="flex items-center gap-2 bg-wdcc-oshan text-white font-mono text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-wdcc-oshan/80 transition-colors duration-150"
          >
            <span className="text-base leading-none">+</span>
            Add member
          </button>
        </div>

        {/* Members grid */}
        {loading ? (
          <p className="font-mono text-sm text-wdcc-grey-light">Loading members...</p>
        ) : members.length === 0 ? (
          <p className="font-mono text-sm text-wdcc-grey-light">No members yet.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {members.map((member) => (
              <li key={member.id}>
                <Link href={`/people/${member.personId}`} className="block">
                  <div
                    className="font-sans transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                    style={{
                      borderRadius: '24px',
                      border: '3px solid transparent',
                      background: BORDER_DEFAULT,
                      transition:
                        'transform 0.25s ease, box-shadow 0.25s ease, background 0.3s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = BORDER_HOVER
                      e.currentTarget.style.boxShadow =
                        '0 12px 32px rgba(227,51,163,0.15), 0 4px 12px rgba(7,124,241,0.1)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = BORDER_DEFAULT
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    <div className="flex flex-col px-7 pt-7 pb-6 gap-4">
                      {/* Avatar + name */}
                      <div className="flex items-center gap-3">
                        <div className="w-[48px] h-[48px] rounded-full bg-wdcc-purple overflow-hidden shrink-0 flex items-center justify-center">
                          {member.person.imageUrl ? (
                            <Image
                              src={member.person.imageUrl}
                              alt={member.person.displayName}
                              width={48}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="font-mono font-bold text-wdcc-kelvin text-sm">
                              {member.person.displayName.charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-[16px] font-extrabold leading-tight text-wdcc-oshan truncate">
                            {member.displayName ?? member.person.displayName}
                          </h3>
                          {member.displayName && (
                            <p className="text-[11px] font-mono text-wdcc-grey-light mt-0.5 truncate">
                              {member.person.displayName}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="w-full h-px bg-wdcc-grey-light/20" />

                      {/* Status + joined */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest px-2.5 py-1.5 rounded-lg font-semibold ${
                            member.isActive
                              ? 'bg-wdcc-mint text-green-700'
                              : 'bg-wdcc-grey-light/10 text-wdcc-grey-light'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${member.isActive ? 'bg-green-500' : 'bg-wdcc-grey-light'}`}
                          />
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <div className="flex items-center gap-1.5 bg-wdcc-grey-light/10 rounded-lg px-2.5 py-1.5">
                          <span className="text-[10px] font-mono uppercase tracking-widest text-wdcc-grey-light">
                            Joined
                          </span>
                          <span className="text-[12px] font-mono font-medium text-wdcc-grey">
                            {new Date(member.joinedAt).toLocaleDateString('en-NZ', {
                              dateStyle: 'medium',
                            })}
                          </span>
                        </div>
                      </div>

                      {/* Identities */}
                      {member.person.identities.length > 0 && (
                        <div className="flex gap-2 flex-wrap">
                          {member.person.identities.map((identity) => {
                            const colors = PROVIDER_COLORS[identity.provider] ?? {
                              bg: 'bg-wdcc-grey-light/10',
                              text: 'text-wdcc-grey',
                            }
                            return (
                              <div
                                key={identity.id}
                                className={`flex items-center gap-1.5 ${colors.bg} rounded-lg px-2.5 py-1.5`}
                              >
                                <span
                                  className={`text-[10px] font-mono uppercase tracking-widest ${colors.text} font-semibold`}
                                >
                                  {identity.provider}
                                </span>
                                <span
                                  className={`text-[11px] font-mono font-medium leading-none ${colors.text} opacity-80`}
                                >
                                  {identity.username ?? identity.externalId}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}
