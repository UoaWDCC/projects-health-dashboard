import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { getInstallationOctokit } from '../lib/github-auth'
import { ingestRepoMergedPRs } from './github-PR-tracker'

vi.mock('../lib/github-auth', () => ({
  getInstallationOctokit: vi.fn(),
}))

vi.mock('./github-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github-utils')>()
  return {
    ...actual,
    withRateLimit: vi.fn((fn: () => unknown) => fn()),
    resolveIdentity: vi.fn().mockResolvedValue('identity-id-1'),
  }
})

vi.mock('./github-commit-tracker', () => ({
  upsertCommit: vi.fn().mockResolvedValue(undefined),
}))

const repo = { id: 'repo-1', owner: 'org', name: 'project', installationId: 'install-1' }
const weekStart = new Date('2026-04-28T00:00:00Z')
const weekEnd = new Date('2026-05-04T23:59:59Z')

function makeFullPr(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: 'Test PR',
    body: 'body',
    html_url: 'https://github.com/org/project/pull/1',
    labels: [{ name: 'feature' }],
    created_at: '2026-04-29T10:00:00Z',
    merged_at: '2026-04-30T10:00:00Z',
    closed_at: '2026-04-30T10:00:00Z',
    additions: 10,
    deletions: 5,
    head: { ref: 'feature-branch' },
    user: { id: 42, login: 'author' },
    merged_by: { id: 99, login: 'merger' },
    ...overrides,
  }
}

function setupOctokit(paginateResponses: unknown[][], requestResponses: unknown[]) {
  const mockPaginate = vi.fn()
  const mockRequest = vi.fn()

  paginateResponses.forEach((res) => mockPaginate.mockResolvedValueOnce(res))
  requestResponses.forEach((res) => mockRequest.mockResolvedValueOnce({ data: res }))

  vi.mocked(getInstallationOctokit).mockResolvedValue({
    paginate: mockPaginate,
    request: mockRequest,
  } as never)

  return { mockPaginate, mockRequest }
}

describe('ingestRepoMergedPRs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 0 and skips db writes when no PRs are merged in window', async () => {
    setupOctokit([[]], [])

    const count = await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    expect(count).toBe(0)
    expect(db.pRFact.upsert).not.toHaveBeenCalled()
  })

  it('upserts a merged PR and returns count of 1', async () => {
    setupOctokit([[{ number: 1 }], []], [makeFullPr()])

    const count = await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    expect(count).toBe(1)
    expect(db.pRFact.upsert).toHaveBeenCalledTimes(1)
    expect(db.pRFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { repoId_number: { repoId: 'repo-1', number: 1 } },
      })
    )
  })

  it('resolves author and mergedBy identities and saves them to the PR record', async () => {
    const { resolveIdentity } = await import('./github-utils.js')
    vi.mocked(resolveIdentity)
      .mockResolvedValueOnce('author-identity')
      .mockResolvedValueOnce('merger-identity')

    setupOctokit([[{ number: 1 }], []], [makeFullPr()])

    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    expect(db.pRFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          authorIdentityId: 'author-identity',
          mergedByIdentityId: 'merger-identity',
        }),
      })
    )
  })

  it('handles a PR with no author or mergedBy without throwing', async () => {
    const { resolveIdentity } = await import('./github-utils.js')
    vi.mocked(resolveIdentity).mockResolvedValue(null)

    setupOctokit([[{ number: 1 }], []], [makeFullPr({ user: null, merged_by: null })])

    await expect(ingestRepoMergedPRs(repo, weekStart, weekEnd)).resolves.toBe(1)
    expect(db.pRFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          authorIdentityId: null,
          mergedByIdentityId: null,
        }),
      })
    )
  })

  it('passes the correct date range to the GitHub search query', async () => {
    const { mockPaginate } = setupOctokit([[]], [])

    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    const query = mockPaginate.mock.calls[0][1].q
    expect(query).toContain('merged:2026-04-28T00:00:00.000+00:00..2026-05-04T23:59:59.000+00:00')
  })

  it('upserts the same PR twice without error', async () => {
    setupOctokit([[{ number: 1 }], []], [makeFullPr()])
    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    setupOctokit([[{ number: 1 }], []], [makeFullPr()])
    await expect(ingestRepoMergedPRs(repo, weekStart, weekEnd)).resolves.toBe(1)
  })
})
