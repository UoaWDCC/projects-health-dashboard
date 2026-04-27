import { db, Prisma } from '@repo/db'

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
  try {
    return await db.project.findMany(projectSelect)
  } catch {
    return []
  }
}
