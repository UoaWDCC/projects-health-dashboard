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

function setupOctokit(
  paginateResponses: unknown[][],
  commitResponses: unknown[],
  defaultBranch = 'main'
) {
  const mockPaginate = vi.fn()
  const mockRequest = vi.fn()

  paginateResponses.forEach((res) => mockPaginate.mockResolvedValueOnce(res))

  let commitIdx = 0
  mockRequest.mockImplementation((route: string) => {
    if (route === 'GET /repos/{owner}/{repo}') {
      return Promise.resolve({ data: { default_branch: defaultBranch } })
    }
    const res = commitResponses[commitIdx++]
    return Promise.resolve({ data: res })
  })

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

      const { mockOctokit, mockRequest } = setupOctokit(
        [],
        [makeCommitData({ sha: 'duplicate-sha', author: { id: 789, login: 'dupuser' } })]
      )

      await upsertCommit(repo, mockOctokit as never, 'duplicate-sha', 'feature-1')
      // second call finds the SHA in DB and returns early — no GitHub API call made
      await upsertCommit(repo, mockOctokit as never, 'duplicate-sha', 'feature-2')

      const commitFetchCalls = mockRequest.mock.calls.filter(
        (c: unknown[]) => c[0] === 'GET /repos/{owner}/{repo}/commits/{sha}'
      )
      expect(commitFetchCalls).toHaveLength(1)

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
    it('fetches commits only from non-default branches via the compare endpoint', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(111, 'dev1')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      const { mockPaginate } = setupOctokit(
        [
          [{ name: 'main' }, { name: 'feature-branch' }],
          [
            {
              sha: 'feature-commit-1',
              commit: { author: { date: '2026-05-05T10:00:00Z' } },
            },
          ],
        ],
        [
          makeCommitData({
            sha: 'feature-commit-1',
            author: { id: 111, login: 'dev1' },
            commit: { message: 'Feature work', author: { date: '2026-05-05T10:00:00Z' } },
          }),
        ]
      )

      await ingestRepoCommits(repo)

      expect(mockPaginate).toHaveBeenCalledTimes(2)
      const paginateCalls = mockPaginate.mock.calls
      expect(paginateCalls[1][0]).toBe('GET /repos/{owner}/{repo}/compare/{basehead}')
      expect(paginateCalls[1][1]).toMatchObject({ basehead: 'main...feature-branch' })

      const savedCommit = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'feature-commit-1' } },
      })
      expect(savedCommit).not.toBeNull()
      expect(savedCommit!.message).toBe('Feature work')
    })

    it('ingests all commits from compare endpoint regardless of author date', async () => {
      const repo = await seedRepo()
      const identity = await seedIdentity(333, 'newdev')
      vi.mocked(resolveIdentity).mockResolvedValue(identity.id)

      setupOctokit(
        [
          [{ name: 'feature' }],
          [
            { sha: 'new-commit', commit: { author: { date: '2026-05-07T10:00:00Z' } } },
            { sha: 'old-commit', commit: { author: { date: '2026-01-01T10:00:00Z' } } },
          ],
        ],
        [
          makeCommitData({
            sha: 'new-commit',
            author: { id: 333, login: 'newdev' },
            commit: { message: 'New commit', author: { date: '2026-05-07T10:00:00Z' } },
          }),
          makeCommitData({
            sha: 'old-commit',
            author: { id: 333, login: 'newdev' },
            commit: { message: 'Old commit', author: { date: '2026-01-01T10:00:00Z' } },
          }),
        ]
      )

      const totalCommits = await ingestRepoCommits(repo)

      expect(totalCommits).toBe(2)

      const savedNew = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'new-commit' } },
      })
      expect(savedNew).not.toBeNull()
      expect(savedNew!.authorIdentityId).toBe(identity.id)

      const savedOld = await db.commitFact.findUnique({
        where: { repoId_sha: { repoId: repo.id, sha: 'old-commit' } },
      })
      expect(savedOld).not.toBeNull()
    })

    it('handles repos with no commits in the window', async () => {
      const repo = await seedRepo()

      const { mockPaginate } = setupOctokit(
        [[{ name: 'feature' }, { name: 'develop' }], [], []],
        []
      )

      const totalCommits = await ingestRepoCommits(repo)

      expect(totalCommits).toBe(0)
      expect(mockPaginate).toHaveBeenCalledTimes(3)

      const allCommits = await db.commitFact.findMany({
        where: { repoId: repo.id },
      })
      expect(allCommits).toHaveLength(0)
    })
  })
})
