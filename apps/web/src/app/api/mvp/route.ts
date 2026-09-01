import { db, pickMVP, type ScoredContributor } from '@repo/db'
import { math } from '@/lib/admin/formula'

// Maps DB field names to the variables in the score formula
const toScope = (contribution: {
  commits: number
  prsMerged: number
  discordMessages: number
  linesAdded: number
  linesRemoved: number
}) => ({
  prs: contribution.prsMerged,
  lines_changed: contribution.linesAdded + contribution.linesRemoved,
  discord_messages: contribution.discordMessages,
  commits: contribution.commits,
})

interface MvpEntry extends ScoredContributor {
  projectId: string
  projectName: string
  memberId: string
  personId: string
}

// GET /api/mvp
// Returns the top contributor per active project for the most recent week.
// Determined by mvp formula, ties broken by lines added, then commits, then alphabetical by displayName.
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

    const formula = await db.config.findFirst({
      where: { key: 'mvpFormula' },
      select: { value: true },
    })

    if (!formula || typeof formula.value !== 'string') {
      return Response.json([])
    }

    const compiledFormula = math.compile(formula.value)

    const contributions = await db.memberWeeklyContribution.findMany({
      where: { weekStart: latest.weekStart, projectMember: { project: { isActive: true } } },
      select: {
        linesAdded: true,
        linesRemoved: true,
        commits: true,
        prsMerged: true,
        discordMessages: true,
        personId: true,
        projectMember: {
          select: {
            id: true,
            displayName: true,
            projectId: true,
            project: { select: { name: true } },
            person: { select: { displayName: true } },
          },
        },
      },
    })

    const scoredByProject = new Map<string, MvpEntry[]>()

    for (const contribution of contributions) {
      const { projectMember } = contribution
      const displayName = projectMember.displayName ?? projectMember.person.displayName
      const rawScore = compiledFormula.evaluate(toScope(contribution))

      let score: number | null
      try {
        score = typeof rawScore === 'number' ? rawScore : math.number(rawScore)
      } catch {
        console.error(
          `MVP formula produced a non-numeric score (${rawScore}) for person ${displayName} in project ${projectMember.projectId}`
        )
        score = null
      }

      if (score !== null && !Number.isFinite(score)) {
        console.error(
          `MVP formula produced a non-finite score (${rawScore}) for person ${displayName} in project ${projectMember.projectId}`
        )
        score = null
      }

      const entry: MvpEntry = {
        projectId: projectMember.projectId,
        projectName: projectMember.project.name,
        memberId: projectMember.id,
        personId: contribution.personId,
        displayName,
        linesAdded: contribution.linesAdded,
        commits: contribution.commits,
        score,
      }

      const group = scoredByProject.get(entry.projectId)
      if (group) group.push(entry)
      else scoredByProject.set(entry.projectId, [entry])
    }

    const result = [...scoredByProject.entries()]
      .map(([projectId, entries]) => {
        const mvp = pickMVP(entries) as MvpEntry | null
        if (!mvp) return null

        return {
          projectId,
          projectName: mvp.projectName,
          weekStart: latest.weekStart,
          mvp: {
            memberId: mvp.memberId,
            personId: mvp.personId,
            displayName: mvp.displayName,
            linesAdded: mvp.linesAdded,
            commits: mvp.commits,
            score: mvp.score as number,
          },
        }
      })
      .filter((entry) => entry !== null)

    return Response.json(result)
  } catch (error) {
    console.error('Error fetching MVP data:', error)
    return Response.json({ error: 'Failed to fetch MVP data' }, { status: 500 })
  }
}
