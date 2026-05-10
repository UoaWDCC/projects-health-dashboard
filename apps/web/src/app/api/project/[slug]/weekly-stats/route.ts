import { db } from '@repo/db'
import { getProjectWeeklyStats } from '@/lib/project/weekly-stats'

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const project = await db.project.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!project) {
      return Response.json({ error: 'Project not found' }, { status: 404 })
    }

    const stats = await getProjectWeeklyStats(project.id)
    return Response.json(stats, { status: 200 })
  } catch (error) {
    console.error('Error fetching weekly stats:', error)
    return Response.json({ error: 'Failed to fetch weekly stats' }, { status: 500 })
  }
}
