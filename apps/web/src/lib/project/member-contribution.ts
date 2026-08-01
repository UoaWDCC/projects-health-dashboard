import { db, Prisma } from '@repo/db'

export const TIME_RANGES = [
  { key: 'week', label: 'Current week' },
  { key: 'last4', label: 'Last 4 weeks' },
  { key: 'all', label: 'All time' },
] as const

export type TimeRangeKey = (typeof TIME_RANGES)[number]['key']

export const METRICS = [
  { key: 'linesAdded', label: 'Lines committed', color: '#E333A3' },
  { key: 'commits', label: 'Commits', color: '#077CF1' },
  { key: 'prsMerged', label: 'PRs merged', color: '#F4900C' },
] as const

export type MetricKey = (typeof METRICS)[number]['key']

export interface MetricComparison {
  member: number
  projectAverage: number
  globalAverage: number
  // Percent difference against each average, or null when the average is 0
  // (there is nothing meaningful to compare against).
  projectDiffPct: number | null
  globalDiffPct: number | null
}

export type RangeBreakdown = Record<MetricKey, MetricComparison>

export interface MemberContributionBreakdown {
  member: {
    id: string
    name: string
    username: string | null
    imageUrl: string | null
  }
  // Monday 00:00 UTC of the most recent week collected for this project, or null
  // when the project has no contribution rows at all.
  latestWeekStart: Date | null
  ranges: Record<TimeRangeKey, RangeBreakdown>
}

const SUM_FIELDS = { linesAdded: true, commits: true, prsMerged: true } as const

const THREE_WEEKS_MS = 3 * 7 * 24 * 60 * 60 * 1000

const ZERO_COMPARISON: MetricComparison = {
  member: 0,
  projectAverage: 0,
  globalAverage: 0,
  projectDiffPct: null,
  globalDiffPct: null,
}

const EMPTY_BREAKDOWN: RangeBreakdown = {
  linesAdded: ZERO_COMPARISON,
  commits: ZERO_COMPARISON,
  prsMerged: ZERO_COMPARISON,
}

type Sums = Partial<Record<MetricKey, number | null>>

function percentDiff(value: number, average: number): number | null {
  if (average === 0) return null
  return ((value - average) / average) * 100
}

/**
 * Week filter for a range, anchored on the project's most recent collected week.
 * `all` spans every week ever collected, so it has no filter.
 */
function weekFilter(range: TimeRangeKey, anchor: Date): Prisma.DateTimeFilter | undefined {
  if (range === 'all') return undefined
  if (range === 'week') return { equals: anchor }
  // Four weeks inclusive of the anchor week.
  return { gte: new Date(anchor.getTime() - THREE_WEEKS_MS), lte: anchor }
}

/**
 * One member's contribution totals for each time range, alongside the average
 * member totals for this project and across every project, so the page can show
 * how the member compares. Every range is computed up front — the client only
 * switches between them.
 *
 * Averages divide by the number of *active* members (of the project, or of all
 * projects), so a member with no contribution row still counts as a zero and
 * drags the average down, matching how the team members page shows them.
 *
 * Returns null when the member does not belong to this project.
 */
export async function getMemberContributionBreakdown(
  slug: string,
  memberId: string
): Promise<MemberContributionBreakdown | null> {
  const member = await db.projectMember.findFirst({
    where: { id: memberId, project: { slug }, isActive: true },
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
  if (!member) return null

  const memberInfo = {
    id: member.id,
    name: member.displayName ?? member.person.displayName,
    username: member.person.identities[0]?.username ?? null,
    imageUrl: member.person.imageUrl,
  }

  // Anchored on this project's latest week rather than a global max: if this
  // project's sync fails for a week another project collected, a global max
  // would resolve to a week this project has no rows for and report zeros.
  const latest = await db.memberWeeklyContribution.findFirst({
    where: { projectMember: { project: { slug } } },
    orderBy: { weekStart: 'desc' },
    select: { weekStart: true },
  })

  if (!latest) {
    return {
      member: memberInfo,
      latestWeekStart: null,
      ranges: { week: EMPTY_BREAKDOWN, last4: EMPTY_BREAKDOWN, all: EMPTY_BREAKDOWN },
    }
  }

  const [projectMemberCount, globalMemberCount, rangeTotals] = await Promise.all([
    db.projectMember.count({ where: { project: { slug }, isActive: true } }),
    db.projectMember.count({ where: { isActive: true } }),
    Promise.all(
      TIME_RANGES.map(async ({ key }) => {
        const weekStart = weekFilter(key, latest.weekStart)
        const window = weekStart ? { weekStart } : {}

        const [memberSums, projectSums, globalSums] = await Promise.all([
          db.memberWeeklyContribution.aggregate({
            where: { ...window, projectMemberId: memberId },
            _sum: SUM_FIELDS,
          }),
          db.memberWeeklyContribution.aggregate({
            where: { ...window, projectMember: { project: { slug }, isActive: true } },
            _sum: SUM_FIELDS,
          }),
          db.memberWeeklyContribution.aggregate({
            where: { ...window, projectMember: { isActive: true } },
            _sum: SUM_FIELDS,
          }),
        ])

        return {
          key,
          memberSums: memberSums._sum,
          projectSums: projectSums._sum,
          globalSums: globalSums._sum,
        }
      })
    ),
  ])

  const build = (memberSums: Sums, projectSums: Sums, globalSums: Sums): RangeBreakdown =>
    Object.fromEntries(
      METRICS.map(({ key }) => {
        const value = memberSums[key] ?? 0
        const projectAverage =
          projectMemberCount > 0 ? (projectSums[key] ?? 0) / projectMemberCount : 0
        const globalAverage = globalMemberCount > 0 ? (globalSums[key] ?? 0) / globalMemberCount : 0

        return [
          key,
          {
            member: value,
            projectAverage,
            globalAverage,
            projectDiffPct: percentDiff(value, projectAverage),
            globalDiffPct: percentDiff(value, globalAverage),
          } satisfies MetricComparison,
        ]
      })
    ) as RangeBreakdown

  const ranges = Object.fromEntries(
    rangeTotals.map(({ key, memberSums, projectSums, globalSums }) => [
      key,
      build(memberSums, projectSums, globalSums),
    ])
  ) as Record<TimeRangeKey, RangeBreakdown>

  return { member: memberInfo, latestWeekStart: latest.weekStart, ranges }
}
