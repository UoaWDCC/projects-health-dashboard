import { db, Prisma } from '@repo/db'
import { unstable_cacheLife, unstable_cacheTag } from 'next/cache'

const projectHeaderSelect = {
  select: {
    id: true,
    name: true,
    description: true,
    imageUrl: true,
    _count: {
      select: {
        members: true,
      },
    },
  },
} satisfies Prisma.ProjectFindManyArgs

const projectCardSelect = {
  select: {
    id: true,
    name: true,
    description: true,
    isActive: true,
    imageUrl: true,
    slug: true,
  },
} satisfies Prisma.ProjectFindManyArgs

export type ProjectHeaderData = Prisma.ProjectGetPayload<typeof projectHeaderSelect>

export type ProjectCardData = Prisma.ProjectGetPayload<typeof projectCardSelect>

export async function getProjectHeaderData(slug: string): Promise<ProjectHeaderData | null> {
  'use cache'
  unstable_cacheLife('days')
  unstable_cacheTag('projects')

  try {
    return await db.project.findUnique({ ...projectHeaderSelect, where: { slug } })
  } catch {
    return null
  }
}

export async function getProjectCardData(): Promise<ProjectCardData[]> {
  'use cache'
  unstable_cacheLife('days')
  unstable_cacheTag('projects')

  try {
    return await db.project.findMany(projectCardSelect)
  } catch {
    return []
  }
}
