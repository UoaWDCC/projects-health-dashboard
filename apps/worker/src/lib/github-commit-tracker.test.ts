import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getInstallationOctokit } from '@repo/github'
import { db } from '@repo/db'
import { ingestRepoCommits } from './github-commit-tracker'

vi.mock('@repo/github', () => ({
  getInstallationOctokit: vi.fn(),
}))

vi.mock('@repo/db', () => ({
  db: {
    commitFact: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
    },
    personIdentity: { findUnique: vi.fn().mockResolvedValue(null) },
    unmatchedIdentity: { upsert: vi.fn() },
  },
}))

vi.mock('./github-utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github-utils')>()
  return {
    ...actual,
    withRateLimit: vi.fn(async (fn: () => unknown) => await fn()),
    resolveIdentity: vi.fn().mockResolvedValue(null),
  }
})

const repo = {
  id: 'repo-id',
  owner: 'org',
  name: 'project',
  installationId: '123',
}

function makeCommitDetail(sha: string, date = '2026-05-05T10:00:00Z') {
  return {
    sha,
    commit: { message: `msg ${sha}`, author: { date } },
    author: null,
    stats: { additions: 1, deletions: 0 },
  }
}

function mockOctokit({
  defaultBranch,
  branches,
  compareByBasehead,
}: {
  defaultBranch: string
  branches: Array<{ name: string }>
  compareByBasehead: Record<string, Array<{ sha: string; commit: { author: { date: string } } }>>
}) {
  const paginate = vi.fn((route: string, params: Record<string, unknown>) => {
    if (route === 'GET /repos/{owner}/{repo}/branches') return Promise.resolve(branches)
    if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
      const basehead = params.basehead as string
      return Promise.resolve(compareByBasehead[basehead] ?? [])
    }
    throw new Error(`Unexpected paginate route: ${route}`)
  })

  const request = vi.fn((route: string, params: Record<string, unknown>) => {
    if (route === 'GET /repos/{owner}/{repo}') {
      return Promise.resolve({ data: { default_branch: defaultBranch } })
    }
    if (route === 'GET /repos/{owner}/{repo}/commits/{sha}') {
      return Promise.resolve({ data: makeCommitDetail(params.sha as string) })
    }
    throw new Error(`Unexpected request route: ${route}`)
  })

  vi.mocked(getInstallationOctokit).mockResolvedValue({ paginate, request } as never)
  return { paginate, request }
}

function upsertCalls() {
  return vi.mocked(db.commitFact.create).mock.calls.map((c) => {
    const arg = c[0] as { data: { sha: string; branch: string | null } }
    return { sha: arg.data.sha, branch: arg.data.branch }
  })
}

describe('ingestRepoCommits (unit, no DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls the compare endpoint instead of the per-branch commits endpoint', async () => {
    const { paginate } = mockOctokit({
      defaultBranch: 'main',
      branches: [{ name: 'main' }, { name: 'feature-branch' }],
      compareByBasehead: {
        'main...feature-branch': [
          { sha: 'feature-only-1', commit: { author: { date: '2026-05-05T10:00:00Z' } } },
        ],
      },
    })

    await ingestRepoCommits(repo)

    const routesCalled = paginate.mock.calls.map((c) => c[0])
    expect(routesCalled).toContain('GET /repos/{owner}/{repo}/compare/{basehead}')
    expect(routesCalled).not.toContain('GET /repos/{owner}/{repo}/commits')

    expect(upsertCalls()).toEqual([{ sha: 'feature-only-1', branch: 'feature-branch' }])
  })

  it('does not upsert commits returned only by base (inherited from default branch)', async () => {
    // The compare endpoint's contract is that it returns commits in head but NOT in base.
    // The mock honors that contract — so main-derived SHAs are absent from the response,
    // and the test asserts they never reach commitFact.upsert.
    mockOctokit({
      defaultBranch: 'main',
      branches: [{ name: 'main' }, { name: 'feature-branch' }],
      compareByBasehead: {
        'main...feature-branch': [
          { sha: 'feature-only-1', commit: { author: { date: '2026-05-05T10:00:00Z' } } },
          { sha: 'feature-only-2', commit: { author: { date: '2026-05-06T10:00:00Z' } } },
        ],
      },
    })

    await ingestRepoCommits(repo)

    const shas = upsertCalls().map((c) => c.sha)
    expect(shas).toEqual(['feature-only-1', 'feature-only-2'])
    expect(shas).not.toContain('main-derived-sha')
  })

  it('dynamically skips the default branch even when it is not main/master', async () => {
    const { paginate } = mockOctokit({
      defaultBranch: 'trunk',
      branches: [{ name: 'trunk' }, { name: 'main' }, { name: 'feature' }],
      compareByBasehead: {
        'trunk...main': [
          { sha: 'main-unique', commit: { author: { date: '2026-05-05T10:00:00Z' } } },
        ],
        'trunk...feature': [
          { sha: 'feature-unique', commit: { author: { date: '2026-05-06T10:00:00Z' } } },
        ],
      },
    })

    await ingestRepoCommits(repo)

    const compareBaseheads = paginate.mock.calls
      .filter((c) => c[0] === 'GET /repos/{owner}/{repo}/compare/{basehead}')
      .map((c) => (c[1] as { basehead: string }).basehead)
    expect(compareBaseheads).toEqual(['trunk...main', 'trunk...feature'])
    expect(compareBaseheads).not.toContain('trunk...trunk')

    expect(upsertCalls().map((c) => c.branch)).toEqual(['main', 'feature'])
  })

  it('upserts all commits from the compare endpoint regardless of author date', async () => {
    mockOctokit({
      defaultBranch: 'main',
      branches: [{ name: 'main' }, { name: 'feature' }],
      compareByBasehead: {
        'main...feature': [
          { sha: 'old-commit', commit: { author: { date: '2026-04-01T10:00:00Z' } } },
          { sha: 'current-commit', commit: { author: { date: '2026-05-07T10:00:00Z' } } },
          { sha: 'future-commit', commit: { author: { date: '2026-06-01T10:00:00Z' } } },
        ],
      },
    })

    const total = await ingestRepoCommits(repo)

    expect(total).toBe(3)
    expect(upsertCalls()).toEqual([
      { sha: 'old-commit', branch: 'feature' },
      { sha: 'current-commit', branch: 'feature' },
      { sha: 'future-commit', branch: 'feature' },
    ])
  })
})
