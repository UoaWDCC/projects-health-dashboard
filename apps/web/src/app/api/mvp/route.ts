import { db } from '@repo/db'

// GET /api/mvp
// Returns the top contributor (by linesAdded) per active team for the most recent week.
// Tiebreaker: most commits, then alphabetical by displayName.
export async function GET() {
  try {
    // Assuming that weekStart is the same for all contributions in the same week, we can just find the most recent one and use that as a filter for the rest of the query.
    const latest = await db.memberWeeklyContribution.findFirst({
      orderBy: { weekStart: 'desc' },
      select: { weekStart: true },
    })

    if (!latest) {
      return Response.json([])
    }

    const contributions = await db.memberWeeklyContribution.findMany({
      where: { weekStart: latest.weekStart },
      select: {
        linesAdded: true,
        commits: true,
        personId: true,
        projectMember: {
          select: {
            id: true,
            displayName: true,
            projectId: true,
            project: {
              select: { id: true, name: true, isActive: true },
            },
            person: {
              select: { displayName: true },
            },
          },
        },
      },
    })

    type MVP = {
      projectName: string
      memberId: string
      personId: string
      displayName: string
      linesAdded: number
      commits: number
    }
    const mvpByProject = new Map<string, MVP>()

    // Iterate through contributions and determine the MVP for each project
    for (const contribution of contributions) {
      const { projectMember } = contribution
      if (!projectMember.project.isActive) continue

      const displayName = projectMember.displayName ?? projectMember.person.displayName
      const currentmvp = mvpByProject.get(projectMember.projectId)

      if (
        !currentmvp ||
        contribution.linesAdded > currentmvp.linesAdded ||
        (contribution.linesAdded === currentmvp.linesAdded &&
          contribution.commits > currentmvp.commits) ||
        (contribution.linesAdded === currentmvp.linesAdded &&
          contribution.commits === currentmvp.commits &&
          displayName < currentmvp.displayName)
      ) {
        mvpByProject.set(projectMember.projectId, {
          projectName: projectMember.project.name,
          memberId: projectMember.id,
          personId: contribution.personId,
          displayName,
          linesAdded: contribution.linesAdded,
          commits: contribution.commits,
        })
      }
    }

    const result = [...mvpByProject.entries()].map(([projectId, mvp]) => ({
      projectId,
      projectName: mvp.projectName,
      weekStart: latest.weekStart,
      mvp: {
        memberId: mvp.memberId,
        personId: mvp.personId,
        displayName: mvp.displayName,
        linesAdded: mvp.linesAdded,
        commits: mvp.commits,
      },
    }))

    return Response.json(result)
  } catch (error) {
    console.error('Error fetching MVP data:', error)
    return Response.json({ error: 'Failed to fetch MVP data' }, { status: 500 })
  }
}
