import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { getProjectTeamMembers } from './weekly-stats'

const member = (id: string, name: string) => ({
  id,
  displayName: name,
  isDeveloper: true,
  isDesigner: false,
  person: { displayName: name, imageUrl: null, identities: [{ username: name.toLowerCase() }] },
})

const sum = (projectMemberId: string, linesAdded: number, commits: number, prsMerged: number) => ({
  projectMemberId,
  _sum: { linesAdded, commits, prsMerged },
})

describe('getProjectTeamMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns [] for a project with no active members', async () => {
    vi.mocked(db.projectMember.findMany).mockResolvedValue([])
    expect(await getProjectTeamMembers('p')).toEqual([])
    expect(db.memberWeeklyContribution.groupBy).not.toHaveBeenCalled()
  })

  it('uses all-time sums, zeros members without rows, and sorts by lines, commits, name', async () => {
    vi.mocked(db.projectMember.findMany).mockResolvedValue([
      member('a', 'Alice'),
      member('b', 'Bob'),
      member('c', 'Cara'),
      member('d', 'Dan'),
    ] as never)
    vi.mocked(db.memberWeeklyContribution.groupBy).mockResolvedValue([
      sum('a', 100, 5, 1),
      sum('b', 100, 9, 2),
      sum('c', 500, 3, 0),
    ] as never)

    const result = await getProjectTeamMembers('p')

    expect(result.map((m) => m.name)).toEqual(['Cara', 'Bob', 'Alice', 'Dan'])
    expect(result[0]).toMatchObject({ linesCommitted: 500, commits: 3, pullRequests: 0 })
    expect(result[3]).toMatchObject({ linesCommitted: 0, commits: 0, pullRequests: 0 })
    const args = vi.mocked(db.memberWeeklyContribution.groupBy).mock.calls[0][0] as {
      where: Record<string, unknown>
    }
    expect(args.where).not.toHaveProperty('weekStart')
  })
})
