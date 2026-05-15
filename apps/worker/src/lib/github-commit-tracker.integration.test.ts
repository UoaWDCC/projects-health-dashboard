import { describe, it, expect, beforeEach, vi } from 'vitest'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { resolveIdentity } from './github-utils'
import { upsertCommit, ingestRepoCommits } from './github-commit-tracker'
import { seedRepo, seedIdentity } from '../test-config/integration.helpers'

vi.mock('@repo/github', () => ({
  getInstallationOctokit: vi.fn(),
}))

vi.mock('./github-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github-utils')>()
  return {
    ...actual,
    resolveIdentity: vi.fn(),
    withRateLimit: vi.fn(async (fn: () => unknown) => await fn()),
  }
})

const weekStart = new Date('2026-05-04T00:00:00Z')
const weekEnd = new Date('2026-05-10T23:59:59Z')

function makeCommitData(overrides: Record<string, unknown> = {}) {
  return {
    sha: 'test-sha',
    commit: {
      message: 'Test commit',
      author: {
        date: '2026-05-05T10:00:00Z',
      },
    },
    author: {
      id: 123,
      login: 'testuser',
    },
    stats: {
      additions: 10,
      deletions: 5,
    },
    ...overrides,
  }
}

function setupOctokit(paginateResponses: unknown[][], commitResponses: unknown[]) {
  const mockPaginate = vi.fn()
  const mockRequest = vi.fn()

  paginateResponses.forEach((res) => mockPaginate.mockResolvedValueOnce(res))
  commitResponses.forEach((res) => mockRequest.mockResolvedValueOnce({ data: res }))

  const mockOctokit = {
    paginate: mockPaginate,
    request: mockRequest,
  }

  vi.mocked(getInstallationOctokit).mockResolvedValue(mockOctokit as never)

  return { mockPaginate, mockRequest, mockOctokit }
}

describe('github-commit-tracker (integration)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
  })

  describe('upsertCommit', () => {
    it('upserts duplicate commits without error', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(789, 'dupuser')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      const { mockOctokit } = setupOctokit(
        [],
        [
          makeCommitData({ sha: 'duplicate-sha', author: { id: 789, login: 'dupuser' } }),
          makeCommitData({ sha: 'duplicate-sha', author: { id: 789, login: 'dupuser' } }),
        ]
      )

      await upsertCommit(repo, mockOctokit as never, 'duplicate-sha', 'feature-1')
      await upsertCommit(repo, mockOctokit as never, 'duplicate-sha', 'feature-2')

      const committedData = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'duplicate-sha' } },
      })

      expect(committedData).not.toBeNull()
      expect(committedData!.authorIdentityId).toBe(identity.id)
      expect(committedData!.message).toBe('Test commit')
      expect(committedData!.branch).toBe('feature-1')
      expect(committedData!.linesAdded).toBe(10)
      expect(committedData!.linesRemoved).toBe(5)
    })

    it('saves commit stats (lines added/removed) correctly', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(999, 'statsuser')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      const { mockOctokit } = setupOctokit(
        [],
        [
          makeCommitData({
            sha: 'stats-test',
            author: { id: 999, login: 'statsuser' },
            stats: { additions: 100, deletions: 50 },
            commit: { message: 'Stats commit', author: { date: '2026-05-05T10:00:00Z' } },
          }),
        ]
      )

      await upsertCommit(repo, mockOctokit as never, 'stats-test', 'stats-branch')

      const committedData = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'stats-test' } },
      })

      expect(committedData).not.toBeNull()
      expect(committedData!.repoId).toBe(repo.id)
      expect(committedData!.sha).toBe('stats-test')
      expect(committedData!.authorIdentityId).toBe(identity.id)
      expect(committedData!.message).toBe('Stats commit')
      expect(committedData!.branch).toBe('stats-branch')
      expect(committedData!.linesAdded).toBe(100)
      expect(committedData!.linesRemoved).toBe(50)
      expect(committedData!.committedAt).not.toBeNull()
      expect(committedData!.ingestedAt).not.toBeNull()
    })

    it('stores commit with null authorIdentityId when author cannot be resolved', async () => {
      const repo = await seedRepo()
      vi.mocked(resolveIdentity).mockResolvedValue(null)

      const { mockOctokit } = setupOctokit(
        [],
        [
          makeCommitData({
            sha: 'unresolved-author-sha',
            author: { id: 555, login: 'ghost-user' },
            commit: {
              message: 'Unresolved author commit',
              author: { date: '2026-05-06T10:00:00Z' },
            },
          }),
        ]
      )

      await upsertCommit(repo, mockOctokit as never, 'unresolved-author-sha', 'feature-unresolved')

      const committedData = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'unresolved-author-sha' } },
      })

      expect(committedData).not.toBeNull()
      expect(committedData!.authorIdentityId).toBeNull()
      expect(committedData!.message).toBe('Unresolved author commit')
      expect(committedData!.branch).toBe('feature-unresolved')
      expect(committedData!.linesAdded).toBe(10)
      expect(committedData!.linesRemoved).toBe(5)
    })
  })

  describe('ingestRepoCommits', () => {
    it('fetches commits only from non-main/master branches', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(111, 'dev1')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      const { mockPaginate } = setupOctokit(
        [
          [{ name: 'main' }, { name: 'master' }, { name: 'feature-branch' }],
          [{ sha: 'feature-commit-1' }],
        ],
        [
          makeCommitData({
            sha: 'feature-commit-1',
            author: { id: 111, login: 'dev1' },
            commit: { message: 'Feature work', author: { date: '2026-05-05T10:00:00Z' } },
          }),
        ]
      )

      await ingestRepoCommits(repo, weekStart, weekEnd)

      expect(mockPaginate).toHaveBeenCalledTimes(2)
      const paginateCalls = mockPaginate.mock.calls
      expect(paginateCalls[1][0]).toBe('GET /repos/{owner}/{repo}/commits')
      expect(paginateCalls[1][1]).toMatchObject({ sha: 'feature-branch' })

      const savedCommit = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'feature-commit-1' } },
      })
      expect(savedCommit).not.toBeNull()
      expect(savedCommit!.message).toBe('Feature work')
    })

    it('respects the weekStart/weekEnd window when filtering commits', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(333, 'newdev')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      const { mockPaginate } = setupOctokit(
        [[{ name: 'feature' }], [{ sha: 'new-commit' }]],
        [
          makeCommitData({
            sha: 'new-commit',
            author: { id: 333, login: 'newdev' },
            commit: { message: 'New commit', author: { date: '2026-05-07T10:00:00Z' } },
          }),
        ]
      )

      const totalCommits = await ingestRepoCommits(repo, weekStart, weekEnd)

      expect(mockPaginate).toHaveBeenCalledWith(
        'GET /repos/{owner}/{repo}/commits',
        expect.objectContaining({
          since: weekStart.toISOString(),
          until: weekEnd.toISOString(),
        })
      )
      expect(totalCommits).toBe(1)

      const savedCommit = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'new-commit' } },
      })
      expect(savedCommit).not.toBeNull()
      expect(savedCommit!.authorIdentityId).toBe(identity.id)
    })

    it('handles repos with no commits in the window', async () => {
      const repo = await seedRepo()

      const { mockPaginate } = setupOctokit(
        [[{ name: 'feature' }, { name: 'develop' }], [], []],
        []
      )

      const totalCommits = await ingestRepoCommits(repo, weekStart, weekEnd)

      expect(totalCommits).toBe(0)
      expect(mockPaginate).toHaveBeenCalledTimes(3)

      const allCommits = await db.commitFact.findMany({
        where: { repoId: repo.id },
      })
      expect(allCommits).toHaveLength(0)
    })
  })
})
