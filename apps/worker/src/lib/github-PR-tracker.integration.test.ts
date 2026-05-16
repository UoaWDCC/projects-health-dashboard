import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { ingestRepoMergedPRs } from './github-PR-tracker'
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

describe('ingestRepoMergedPRs (integration)', () => {
  beforeEach(async () => {
    await db.pRFact.deleteMany()
    await db.unmatchedIdentity.deleteMany()
    await db.personIdentity.deleteMany()
    await db.person.deleteMany()
    await db.gitHubRepository.deleteMany()
    await db.project.deleteMany()
  })

  it('returns 0 and writes nothing to the DB when no PRs are merged in window', async () => {
    const repo = await seedRepo()
    setupOctokit([[]], [])

    const count = await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    expect(count).toBe(0)
    expect(await db.pRFact.count()).toBe(0)
  })

  it('writes the PR to the DB with correct fields', async () => {
    const repo = await seedRepo()
    setupOctokit([[{ number: 1 }]], [makeFullPr()])

    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })

    expect(pr).not.toBeNull()
    expect(pr!.title).toBe('Test PR')
    expect(pr!.linesAdded).toBe(10)
    expect(pr!.linesRemoved).toBe(5)
    expect(pr!.repoId).toBe(repo.id)
  })

  it('resolves a known author identity and saves it on the PR', async () => {
    const repo = await seedRepo()
    const identity = await seedIdentity(42, 'author')
    setupOctokit([[{ number: 1 }]], [makeFullPr()])

    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })

    expect(pr!.authorIdentityId).toBe(identity.id)
  })

  it('creates an unmatchedIdentity when author is not in the DB', async () => {
    const repo = await seedRepo()
    setupOctokit([[{ number: 1 }]], [makeFullPr()])

    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

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
    setupOctokit([[{ number: 1 }]], [makeFullPr({ user: null, merged_by: null })])

    await expect(ingestRepoMergedPRs(repo, weekStart, weekEnd)).resolves.toBe(1)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })
    expect(pr!.authorIdentityId).toBeNull()
    expect(pr!.mergedByIdentityId).toBeNull()
  })

  it('upserts a duplicate PR without creating a second record and preserves identity fields', async () => {
    const repo = await seedRepo()
    const identity = await seedIdentity(42, 'author')

    setupOctokit([[{ number: 1 }]], [makeFullPr()])
    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    setupOctokit([[{ number: 1 }]], [makeFullPr({ title: 'Updated Title' })])
    await ingestRepoMergedPRs(repo, weekStart, weekEnd)

    expect(await db.pRFact.count()).toBe(1)

    const pr = await db.pRFact.findUnique({
      where: { repoId_number: { repoId: repo.id, number: 1 } },
    })
    expect(pr!.title).toBe('Updated Title')
    expect(pr!.authorIdentityId).toBe(identity.id)
  })
})
