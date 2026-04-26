import { db } from '@repo/db'

interface ProjectDetails {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  imageUrl: string | null
  startedAt: Date | null
  createdAt: Date
}

export async function getProjects(): Promise<ProjectDetails[]> {
  try {
    const projects = await db.project.findMany()
    return projects
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}
