import { db } from '@repo/db'
import { math } from '../admin/formula'

// Maps DB field names to the variables in the score formula.
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

export async function getProjectWeeklyMvp(slug: string) {
  const latest = await db.memberWeeklyContribution.findFirst({
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })
  if (!latest) return null

  const formula = await db.config.findFirst({
    where: { key: 'mvpFormula' },
    select: { value: true },
  })

  if (!formula || typeof formula.value !== 'string') {
    return null
  }

  const compiledFormula = math.compile(formula.value)

  const contributions = await db.memberWeeklyContribution.findMany({
    where: {
      weekStart: latest.weekStart,
      projectMember: { project: { slug } },
    },
    select: {
      linesAdded: true,
      linesRemoved: true,
      commits: true,
      prsMerged: true,
      discordMessages: true,
      projectMember: {
        select: {
          displayName: true,
          person: { select: { displayName: true, imageUrl: true } },
        },
      },
    },
  })

  if (contributions.length === 0) return null

  let mvp: ((typeof contributions)[number] & { score: number }) | null = null

  // Iterate through contributions and determine the MVP
  for (const contribution of contributions) {
    const rawScore = compiledFormula.evaluate(toScope(contribution))
    let score: number

    try {
      score = typeof rawScore === 'number' ? rawScore : math.number(rawScore)
    } catch {
      console.error(
        `MVP formula produced a non-numeric score (${rawScore}) for person ${contribution.projectMember.displayName ?? contribution.projectMember.person.displayName} in project ${slug}`
      )
      continue
    }

    if (!Number.isFinite(score)) {
      console.error(
        `MVP formula produced a non-finite score (${rawScore}) for person ${contribution.projectMember.displayName ?? contribution.projectMember.person.displayName} in project ${slug}`
      )
      continue
    }

    if (
      !mvp ||
      score > mvp.score ||
      (score === mvp.score &&
        (contribution.linesAdded > mvp.linesAdded ||
          (contribution.linesAdded === mvp.linesAdded && contribution.commits > mvp.commits) ||
          (contribution.linesAdded === mvp.linesAdded &&
            contribution.commits === mvp.commits &&
            (contribution.projectMember.displayName ??
              contribution.projectMember.person.displayName) <
              (mvp.projectMember.displayName ?? mvp.projectMember.person.displayName))))
    ) {
      mvp = { ...contribution, score }
    }
  }

  return mvp
}

export interface TeamMemberStats {
  id: string
  name: string
  username: string | null
  imageUrl: string | null
  linesCommitted: number
  commits: number
  pullRequests: number
}

/**
 * All active members of a project with their contribution stats for that
 * project's most recent collected week, ranked by lines committed (ties broken
 * by commits, then name). Members with no contribution row for the week show
 * zeros.
 */
export async function getProjectTeamMembers(slug: string): Promise<TeamMemberStats[]> {
  const members = await db.projectMember.findMany({
    where: { project: { slug }, isActive: true },
    select: {
      id: true,
      displayName: true,
      person: {
        select: {
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
  if (members.length === 0) return []

  const memberIds = members.map((m) => m.id)

  // Scoped to this project's members rather than the global max weekStart: if this
  // project's sync fails for a week that another project collected, a global max
  // would resolve to a week this project has no rows for and zero out every member.
  const latest = await db.memberWeeklyContribution.findFirst({
    where: { projectMemberId: { in: memberIds } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })

  const contributions = latest
    ? await db.memberWeeklyContribution.findMany({
        where: {
          weekStart: latest.weekStart,
          projectMemberId: { in: memberIds },
        },
        select: { projectMemberId: true, linesAdded: true, commits: true, prsMerged: true },
      })
    : []
  const contributionsByMember = new Map(contributions.map((c) => [c.projectMemberId, c]))

  return members
    .map((m) => {
      const contribution = contributionsByMember.get(m.id)
      return {
        id: m.id,
        name: m.displayName ?? m.person.displayName,
        username: m.person.identities[0]?.username ?? null,
        imageUrl: m.person.imageUrl,
        linesCommitted: contribution?.linesAdded ?? 0,
        commits: contribution?.commits ?? 0,
        pullRequests: contribution?.prsMerged ?? 0,
      }
    })
    .sort(
      (a, b) =>
        b.linesCommitted - a.linesCommitted || b.commits - a.commits || a.name.localeCompare(b.name)
    )
}

export interface ProjectWeeklyStats {
  dates: string[]
  commits: number[]
  prs: number[]
  linesChanged: number[]
  discordMessages: number[]
  healthScore: number[]
}

export interface TeamWeeklyStats extends ProjectWeeklyStats {
  slug: string
  name: string
}

export type MetricKey = Extract<
  keyof ProjectWeeklyStats,
  'commits' | 'prs' | 'linesChanged' | 'discordMessages' | 'healthScore'
>

export const METRICS: { key: MetricKey; title: string }[] = [
  { key: 'commits', title: 'Weekly Commits' },
  { key: 'prs', title: 'Weekly PRs' },
  { key: 'linesChanged', title: 'Weekly Lines Changed' },
  { key: 'discordMessages', title: 'Weekly Discord Messages' },
  { key: 'healthScore', title: 'Weekly Health Score' },
]

export async function getProjectWeeklyStats(projectId: string): Promise<ProjectWeeklyStats> {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))

  const rows = await db.weeklyStats.findMany({
    where: {
      projectId,
      weekStart: { gte: yearStart },
    },
    orderBy: { weekStart: 'asc' },
    select: {
      weekStart: true,
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
      healthScore: true,
    },
  })

  return {
    dates: rows.map((r) => r.weekStart.toISOString().split('T')[0]),
    commits: rows.map((r) => r.commits),
    prs: rows.map((r) => r.prsMerged),
    linesChanged: rows.map((r) => r.linesAdded + r.linesRemoved),
    discordMessages: rows.map((r) => r.discordMessages),
    healthScore: rows.map((r) => r.healthScore ?? 0),
  }
}

/**
 * Weekly stats for every project, for the exec comparison view.
 * Same shape as getProjectWeeklyStats but scoped across all projects
 * in a single query instead of N sequential calls.
 */
export async function getAllProjectsWeeklyStats(): Promise<TeamWeeklyStats[]> {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1))

  const rows = await db.weeklyStats.findMany({
    where: {
      weekStart: { gte: yearStart },
      project: { isActive: true },
    },
    orderBy: { weekStart: 'asc' },
    select: {
      weekStart: true,
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
      healthScore: true,
      project: {
        select: { slug: true, name: true },
      },
    },
  })

  const byProject = new Map<string, TeamWeeklyStats>()

  for (const r of rows) {
    const slug = r.project.slug
    let team = byProject.get(slug)
    if (!team) {
      team = {
        slug,
        name: r.project.name,
        dates: [],
        commits: [],
        prs: [],
        linesChanged: [],
        discordMessages: [],
        healthScore: [],
      }
      byProject.set(slug, team)
    }

    team.dates.push(r.weekStart.toISOString().split('T')[0])
    team.commits.push(r.commits)
    team.prs.push(r.prsMerged)
    team.linesChanged.push(r.linesAdded + r.linesRemoved)
    team.discordMessages.push(r.discordMessages)
    team.healthScore.push(r.healthScore ?? 0)
  }

  return Array.from(byProject.values())
}
