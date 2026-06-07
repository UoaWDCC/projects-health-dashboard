import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { ingestRepoPRs } from './github-PR-tracker'
import { upsertCommit } from './github-commit-tracker'
import { seedRepo, seedIdentity } from '../test-config/integration.helpers.js'

vi.mock('@repo/github', () => ({
  getInstallationOctokit: vi.fn(),
}))

vi.mock('./github-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github-utils')>()
  return {
    ...actual,
    withRateLimit: vi.fn((fn: () => unknown) => fn()),
  }
})

vi.mock('./github-commit-tracker', () => ({
  upsertCommit: vi.fn().mockResolvedValue(undefined),
}))

// current week: Mon 28 Apr – Sun 4 May 2026
const weekStart = new Date('2026-04-28T00:00:00Z')
const weekEnd = new Date('2026-05-04T23:59:59Z')
// lookback start = Mon 21 Apr (Monday of the previous week)

function makeFullPr(overrides: Record<string, unknown> = {}) {
  return {
    number: 1,
    title: 'Test PR',
    body: 'body',
    html_url: 'https://github.com/org/project/pull/1',
    labels: [{ name: 'feature' }],
    created_at: '2026-04-29T10:00:00Z',
    merged_at: '2026-04-30T10:00:00Z', // within weekStart..weekEnd by default
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

describe('ingestRepoPRs (integration)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    await db.pRFact.deleteMany()
    await db.unmatchedIdentity.deleteMany()
    await db.personIdentity.deleteMany()
    await db.person.deleteMany()
    await db.gitHubRepository.deleteMany()
    await db.project.deleteMany()
  })

  it('returns 0 and writes nothing when no PRs are found in the 2-week window', async () => {
    const repo = await seedRepo()
    setupOctokit([[]], [])

    const count = await ingestRepoPRs(repo, weekStart, weekEnd)

    expect(count).toBe(0)
    expect(await db.pRFact.count()).toBe(0)
  })

  it('writes PRFact for a PR merged within the current week', async () => {
    const repo = await seedRepo()
    // paginateResponses: [search results, commits for PR #1]
    setupOctokit([[{ number: 1 }], []], [makeFullPr()])

    await ingestRepoPRs(repo, weekStart, weekEnd)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })

    expect(pr).not.toBeNull()
    expect(pr!.title).toBe('Test PR')
    expect(pr!.linesAdded).toBe(10)
    expect(pr!.linesRemoved).toBe(5)
    expect(pr!.repoId).toBe(repo.id)
  })

  it('does not write PRFact for a PR merged before the current week but still captures commits', async () => {
    const repo = await seedRepo()
    // merged_at is within the lookback window but before weekStart
    setupOctokit(
      [[{ number: 1 }], [{ sha: 'old-commit' }]],
      [makeFullPr({ merged_at: '2026-04-22T10:00:00Z', closed_at: '2026-04-22T10:00:00Z' })]
    )

    const count = await ingestRepoPRs(repo, weekStart, weekEnd)

    expect(count).toBe(0)
    expect(await db.pRFact.count()).toBe(0)
    expect(vi.mocked(upsertCommit)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'old-commit',
      'feature-branch'
    )
  })

  it('does not write PRFact for an open or closed-unmerged PR but still captures commits', async () => {
    const repo = await seedRepo()
    setupOctokit(
      [[{ number: 1 }], [{ sha: 'open-commit' }]],
      [makeFullPr({ merged_at: null, closed_at: null })]
    )

    const count = await ingestRepoPRs(repo, weekStart, weekEnd)

    expect(count).toBe(0)
    expect(await db.pRFact.count()).toBe(0)
    expect(vi.mocked(upsertCommit)).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      'open-commit',
      'feature-branch'
    )
  })

  it('resolves a known author identity and saves it on the PR', async () => {
    const repo = await seedRepo()
    const identity = await seedIdentity(42, 'author')
    setupOctokit([[{ number: 1 }], []], [makeFullPr()])

    await ingestRepoPRs(repo, weekStart, weekEnd)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })

    expect(pr!.authorIdentityId).toBe(identity.id)
  })

  it('creates an unmatchedIdentity when author is not in the DB', async () => {
    const repo = await seedRepo()
    setupOctokit([[{ number: 1 }], []], [makeFullPr()])

    await ingestRepoPRs(repo, weekStart, weekEnd)

    const unmatched = await db.unmatchedIdentity.findUnique({
      where: { provider_externalId: { provider: 'GITHUB', externalId: '42' } },
    })

    expect(unmatched).not.toBeNull()
    expect(unmatched!.username).toBe('author')

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })
    expect(pr!.authorIdentityId).toBeNull()
  })

  it('handles a PR with no author or mergedBy without throwing', async () => {
    const repo = await seedRepo()
    setupOctokit([[{ number: 1 }], []], [makeFullPr({ user: null, merged_by: null })])

    await expect(ingestRepoPRs(repo, weekStart, weekEnd)).resolves.toBe(1)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })
    expect(pr!.authorIdentityId).toBeNull()
    expect(pr!.mergedByIdentityId).toBeNull()
  })

  it('upserts a duplicate PR without creating a second record and preserves identity fields', async () => {
    const repo = await seedRepo()
    const identity = await seedIdentity(42, 'author')

    setupOctokit([[{ number: 1 }], []], [makeFullPr()])
    await ingestRepoPRs(repo, weekStart, weekEnd)

    setupOctokit([[{ number: 1 }], []], [makeFullPr({ title: 'Updated Title' })])
    await ingestRepoPRs(repo, weekStart, weekEnd)

    expect(await db.pRFact.count()).toBe(1)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })
    expect(pr!.title).toBe('Updated Title')
    expect(pr!.authorIdentityId).toBe(identity.id)
  })
})
