import { db } from '@repo/db'
import { unstable_cacheLife, unstable_cacheTag } from 'next/cache'

export const AVATAR_COLORS = ['#077CF1', '#4CAF64', '#E333A3', '#F2A33C', '#9A63F0', '#48A6A6']

export interface ProjectMemberSummary {
  id: string
  name: string
  imageUrl: string | null
  githubUsername: string | null
}

export async function getProjectMembers(slug: string): Promise<ProjectMemberSummary[]> {
  'use cache'
  unstable_cacheLife('minutes')
  unstable_cacheTag('projects')

  const members = await db.projectMember.findMany({
    where: { project: { slug }, isActive: true },
    select: {
      id: true,
      displayName: true,
      person: {
        select: {
          id: true,
          displayName: true,
          imageUrl: true,
          identities: {
            where: { provider: 'GITHUB' },
            select: { username: true },
          },
        },
      },
    },
  })

  return members.map((member) => ({
    id: member.id,
    name: member.displayName ?? member.person.displayName,
    imageUrl: member.person.imageUrl,
    githubUsername: member.person.identities[0]?.username ?? null,
  }))
}
