import { db, Prisma } from '@repo/db'
import { unstable_cacheLife, unstable_cacheTag } from 'next/cache'

const projectSelect = {
  select: {
    id: true,
    name: true,
    description: true,
    isActive: true,
    imageUrl: true,
  },
} satisfies Prisma.ProjectFindManyArgs

export type ProjectCardData = Prisma.ProjectGetPayload<typeof projectSelect>

export async function getProjectCardData(): Promise<ProjectCardData[]> {
  'use cache'
  unstable_cacheLife('days')
  unstable_cacheTag('projects')

  try {
    return await db.project.findMany(projectSelect)
  } catch {
    return []
  }
}
