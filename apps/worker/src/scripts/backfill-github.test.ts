import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { upsertCommit } from '../lib/github-commit-tracker'
import { computeWeeklyGitHubMetrics } from '../lib/github-weekly-stats'
import { resolveIdentity } from '../lib/github-utils'

vi.mock('@repo/github', () => ({
  getInstallationOctokit: vi.fn(),
}))
vi.mock('../lib/github-commit-tracker', () => ({
  upsertCommit: vi.fn(),
}))
vi.mock('../lib/github-utils', () => ({
  resolveIdentity: vi.fn(),
  withRateLimit: vi.fn((fn) => fn()),
}))
vi.mock('../lib/github-weekly-stats', () => ({
  computeWeeklyGitHubMetrics: vi.fn(),
}))
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { logger } from '../lib/logger'
import { backfillRepoPRs, main, parseDateRange } from './backfill-github'

const repo = {
  id: '1',
  owner: 'UoAWDCC',
  name: 'projects-health-dashboard',
  installationId: '1',
}

function makeOctokit() {
  return {
    paginate: vi.fn(),
    request: vi.fn(),
  }
}

function makeFullPr(number: number, mergedAt: string, headRef = `feat/${number}`) {
  return {
    number,
    title: `PR ${number}`,
    body: `Body`,
    html_url: `https://github.com/org/project/pull/${number}`,
    labels: [{ name: 'feature' }],
    created_at: '2026-05-01T10:00:00Z',
    merged_at: mergedAt,
    closed_at: mergedAt,
    additions: 10,
    deletions: 5,
    head: { ref: headRef },
    user: { id: 42, login: `author` },
    merged_by: { id: 99, login: `merger` },
  }
}

describe('backfillRepoPRs', () => {
  beforeEach(() => {
    vi.mocked(resolveIdentity).mockResolvedValue('identity-1')
  })

  it('fetches PRs and branch commits across the full date range and upserts PRFact and CommitFact rows correctly', async () => {
    const octokit = makeOctokit()
    const fromDate = new Date('2026-05-04T00:00:00.000Z')
    const toDate = new Date('2026-05-18T00:00:00.000Z')

    octokit.paginate.mockImplementation(async (route: string, params: Record<string, unknown>) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        // sample PR data, should fetch PR #1 and #2 but not #3 (merged before fromDate)
        return [
          {
            number: 1,
            state: 'closed',
            merged_at: '2026-05-06T12:00:00Z',
            created_at: '2026-05-01T10:00:00Z',
            closed_at: '2026-05-06T12:00:00Z',
            head: { ref: 'feat/one' },
          },
          {
            number: 2,
            state: 'closed',
            merged_at: '2026-05-13T12:00:00Z',
            created_at: '2026-05-10T10:00:00Z',
            closed_at: '2026-05-13T12:00:00Z',
            head: { ref: 'feat/two' },
          },
          {
            number: 3,
            state: 'closed',
            merged_at: '2026-04-29T12:00:00Z',
            created_at: '2026-04-20T10:00:00Z',
            closed_at: '2026-04-29T12:00:00Z',
            head: { ref: 'feat/old' },
          },
        ]
      }

      if (route === 'GET /repos/{owner}/{repo}/branches') {
        return [{ name: 'main' }, { name: 'feat/branch-only' }]
      }

      // sample commits for PRs and branches
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits') {
        if (params.pull_number === 1) {
          return [
            { sha: 'pr-1-in-range', commit: { author: { date: '2026-05-05T09:00:00Z' } } },
            // should ignore commits at window's upper bound
            { sha: 'pr-1-at-upper-bound', commit: { author: { date: '2026-05-18T00:00:00Z' } } },
          ]
        }

        if (params.pull_number === 2) {
          return [
            { sha: 'pr-2-in-range', commit: { author: { date: '2026-05-14T09:00:00Z' } } },
            // should ignore commits with no author
            { sha: 'pr-2-no-author-date', commit: { author: null } },
          ]
        }
      }

      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        // should fetch branch-in-range but not branch-old (before fromDate) or branch-at-upper-bound (at toDate)
        return [
          { sha: 'branch-old', commit: { author: { date: '2026-05-01T09:00:00Z' } } },
          { sha: 'branch-in-range', commit: { author: { date: '2026-05-15T09:00:00Z' } } },
          { sha: 'branch-at-upper-bound', commit: { author: { date: '2026-05-18T00:00:00Z' } } },
        ]
      }

      return []
    })

    octokit.request.mockImplementation(async (route: string, params: Record<string, unknown>) => {
      if (route === 'GET /repos/{owner}/{repo}') {
        return { data: { default_branch: 'main' } }
      }
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
        return {
          data:
            params.pull_number === 1
              ? makeFullPr(1, '2026-05-06T12:00:00Z', 'feat/one')
              : makeFullPr(2, '2026-05-13T12:00:00Z', 'feat/two'),
        }
      }

      throw new Error(`Unexpected request route: ${route}`)
    })

    const result = await backfillRepoPRs(repo, octokit as never, fromDate, toDate)

    expect(octokit.paginate).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/pulls',
      expect.objectContaining({ owner: 'UoAWDCC', repo: 'projects-health-dashboard', state: 'all' })
    )
    expect(db.pRFact.upsert).toHaveBeenCalledTimes(2)
    expect(db.pRFact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { repoId_number: { repoId: '1', number: 1 } },
        create: expect.objectContaining({
          repoId: '1',
          number: 1,
          title: 'PR 1',
          labels: ['feature'],
          mergedAt: new Date('2026-05-06T12:00:00Z'),
          linesAdded: 10,
          linesRemoved: 5,
        }),
      })
    )
    expect(upsertCommit).toHaveBeenCalledTimes(3)
    expect(upsertCommit).toHaveBeenCalledWith(repo, octokit, 'pr-1-in-range', 'feat/one')
    expect(upsertCommit).toHaveBeenCalledWith(repo, octokit, 'pr-2-in-range', 'feat/two')
    expect(upsertCommit).toHaveBeenCalledWith(repo, octokit, 'branch-in-range', 'feat/branch-only')
    expect(result.prCount).toBe(2)
    expect(result.commitCount).toBe(3)
    expect([...result.weekStarts].sort()).toEqual([
      '2026-05-04T00:00:00.000Z',
      '2026-05-11T00:00:00.000Z',
    ])
  })

  it('gets commits from open PRs without upserting PRFact rows', async () => {
    const octokit = makeOctokit()
    const fromDate = new Date('2026-05-04T00:00:00.000Z')
    const toDate = new Date('2026-05-11T00:00:00.000Z')

    octokit.paginate.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        return [
          {
            number: 10,
            state: 'open',
            merged_at: null,
            created_at: '2026-05-05T10:00:00Z',
            closed_at: null,
            head: { ref: 'feat/open' },
          },
        ]
      }

      if (route === 'GET /repos/{owner}/{repo}/branches') return [{ name: 'main' }]

      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits') {
        return [{ sha: 'open-pr-commit', commit: { author: { date: '2026-05-06T09:00:00Z' } } }]
      }

      return []
    })
    octokit.request.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}') return { data: { default_branch: 'main' } }

      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
        return {
          data: {
            ...makeFullPr(10, '2026-05-06T12:00:00Z', 'feat/open'),
            merged_at: null,
            closed_at: null,
            merged_by: null,
          },
        }
      }

      throw new Error(`Unexpected request route: ${route}`)
    })

    const result = await backfillRepoPRs(repo, octokit as never, fromDate, toDate)

    expect(db.pRFact.upsert).not.toHaveBeenCalled()
    expect(upsertCommit).toHaveBeenCalledTimes(1)
    expect(upsertCommit).toHaveBeenCalledWith(repo, octokit, 'open-pr-commit', 'feat/open')
    expect(result.prCount).toBe(0)
    expect(result.commitCount).toBe(1)
  })

  it('continues to branch commits when fetching commits for a PR fails', async () => {
    const octokit = makeOctokit()
    const fromDate = new Date('2026-05-04T00:00:00.000Z')
    const toDate = new Date('2026-05-11T00:00:00.000Z')

    octokit.paginate.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls') {
        return [
          {
            number: 7,
            state: 'closed',
            merged_at: '2026-05-06T12:00:00Z',
            created_at: '2026-05-01T10:00:00Z',
            closed_at: '2026-05-06T12:00:00Z',
            head: { ref: 'feat/seven' },
          },
        ]
      }

      if (route === 'GET /repos/{owner}/{repo}/branches') {
        return [{ name: 'main' }, { name: 'feat/branch-after-error' }]
      }

      // simulate error fetching commits for the PR
      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}/commits') {
        throw new Error('GitHub PR commits unavailable')
      }

      // should still fetch commits for branches even if PR commit fetching fails
      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') {
        return [
          { sha: 'branch-after-pr-error', commit: { author: { date: '2026-05-07T09:00:00Z' } } },
        ]
      }

      return []
    })

    octokit.request.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}') return { data: { default_branch: 'main' } }

      if (route === 'GET /repos/{owner}/{repo}/pulls/{pull_number}') {
        return { data: makeFullPr(7, '2026-05-06T12:00:00Z', 'feat/seven') }
      }

      throw new Error(`Unexpected request route: ${route}`)
    })

    const result = await backfillRepoPRs(repo, octokit as never, fromDate, toDate)

    expect(db.pRFact.upsert).toHaveBeenCalledTimes(1)
    expect(upsertCommit).toHaveBeenCalledTimes(1)
    expect(upsertCommit).toHaveBeenCalledWith(
      repo,
      octokit,
      'branch-after-pr-error',
      'feat/branch-after-error'
    )
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch commits for PR #7')
    )
    expect(result.prCount).toBe(1)
    expect(result.commitCount).toBe(1)
  })

  it('skips the default branch and warns when compare results may be truncated', async () => {
    const octokit = makeOctokit()
    const fromDate = new Date('2026-05-04T00:00:00.000Z')
    const toDate = new Date('2026-05-11T00:00:00.000Z')
    // simulate a branch with a very large number of commits to trigger GitHub's 250-commit cap on the compare endpoint
    // will skip all of these commits as they are outside the date range
    const truncatedCommits = Array.from({ length: 250 }, (_, i) => ({
      sha: `old-${i}`,
      commit: { author: { date: '2026-04-01T09:00:00Z' } },
    }))

    octokit.paginate.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/pulls') return []

      if (route === 'GET /repos/{owner}/{repo}/branches') {
        return [{ name: 'main' }, { name: 'feature-large' }]
      }

      if (route === 'GET /repos/{owner}/{repo}/compare/{basehead}') return truncatedCommits

      throw new Error(`Unexpected paginate route: ${route}`)
    })
    octokit.request.mockResolvedValue({ data: { default_branch: 'main' } })

    const result = await backfillRepoPRs(repo, octokit as never, fromDate, toDate)

    expect(octokit.paginate).toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/compare/{basehead}',
      expect.objectContaining({ basehead: 'main...feature-large' }),
      expect.any(Function)
    )
    // skips compare for default branch
    expect(octokit.paginate).not.toHaveBeenCalledWith(
      'GET /repos/{owner}/{repo}/compare/{basehead}',
      expect.objectContaining({ basehead: 'main...main' }),
      expect.any(Function)
    )
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('may be truncated'))
    expect(upsertCommit).not.toHaveBeenCalled()
    // should still return prCount and commitCount of 0 even if compare results are truncated
    expect(result).toEqual({ prCount: 0, commitCount: 0, weekStarts: new Set() })
  })
})

describe('parseDateRange', () => {
  const originalArgv = process.argv

  afterEach(() => {
    process.argv = originalArgv
  })

  it('snaps arbitrary input dates to correct week boundaries', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-10', '--to', '2026-05-12']

    const { fromDate, toDate } = parseDateRange()

    expect(fromDate.toISOString()).toBe('2026-05-04T00:00:00.000Z')
    expect(toDate.toISOString()).toBe('2026-05-18T00:00:00.000Z')
  })

  it('snaps Sunday --from dates to the previous Monday and Sunday --to dates to the next Monday', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-10', '--to', '2026-05-10']

    const { fromDate, toDate } = parseDateRange()

    expect(fromDate.toISOString()).toBe('2026-05-04T00:00:00.000Z')
    expect(toDate.toISOString()).toBe('2026-05-11T00:00:00.000Z')
  })

  it('snaps Monday --to dates to the following Monday', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-11', '--to', '2026-05-11']

    const { fromDate, toDate } = parseDateRange()

    expect(fromDate.toISOString()).toBe('2026-05-11T00:00:00.000Z')
    expect(toDate.toISOString()).toBe('2026-05-18T00:00:00.000Z')
  })

  it('throws with usage when --from is missing', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--to', '2026-05-12']
    expect(() => parseDateRange()).toThrow('Usage: pnpm backfill:github')
  })

  it('throws for an invalid --from date string', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', 'not-a-date']
    expect(() => parseDateRange()).toThrow('Invalid --from date: not-a-date')
  })

  it('throws for an invalid --to date string', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-04', '--to', 'not-a-date']
    expect(() => parseDateRange()).toThrow('Invalid --to date: not-a-date')
  })

  it('throws when --from is not before --to', () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-18', '--to', '2026-05-06']
    expect(() => parseDateRange()).toThrow('must be before --to')
  })
})

describe('main', () => {
  const originalArgv = process.argv
  const savedGithubAppId = process.env.GITHUB_APP_ID
  const savedGithubPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY

  beforeEach(() => {
    process.env.GITHUB_APP_ID = '1'
    process.env.GITHUB_APP_PRIVATE_KEY = 'private-key'
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-06', '--to', '2026-05-06']

    const octokit = makeOctokit()
    octokit.paginate.mockImplementation(async (route: string) => {
      if (route === 'GET /repos/{owner}/{repo}/branches') return [{ name: 'main' }]
      return []
    })
    octokit.request.mockResolvedValue({ data: { default_branch: 'main' } })

    vi.mocked(getInstallationOctokit).mockResolvedValue(octokit as never)
    vi.mocked(db.syncJob.create).mockImplementation((async () => {
      const callNumber = vi.mocked(db.syncJob.create).mock.calls.length
      return { id: `sync-${callNumber}` } as never
    }) as never)
    vi.mocked(db.syncJob.update).mockResolvedValue({} as never)
    vi.mocked(computeWeeklyGitHubMetrics).mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.argv = originalArgv
    process.env.GITHUB_APP_ID = savedGithubAppId
    process.env.GITHUB_APP_PRIVATE_KEY = savedGithubPrivateKey
  })

  it('creates a SyncJob record and associates it with the correct projects', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'p1', name: 'project-health-dashboard', repositories: [repo] },
      {
        id: 'p2',
        name: 'SSA',
        repositories: [{ ...repo, id: 'repo-2', installationId: '2' }],
      },
    ] as never)

    await main()

    expect(db.syncJob.create).toHaveBeenCalledTimes(2)
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', type: 'GITHUB', status: 'RUNNING' }),
    })
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p2', type: 'GITHUB', status: 'RUNNING' }),
    })
  })

  it('creates no SyncJobs for projects with no repositories', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'p1', name: 'No Repos', repositories: [] },
    ] as never)

    await main()

    expect(db.syncJob.create).not.toHaveBeenCalled()
  })

  it('uses one SyncJob entry for a date range spanning multiple weeks', async () => {
    process.argv = ['pnpm', 'backfill:github:[dev]', '--from', '2026-05-06', '--to', '2026-05-20']
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'p1', name: 'project-health-dashboard', repositories: [repo] },
    ] as never)

    await main()

    expect(db.syncJob.create).toHaveBeenCalledTimes(1)
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', type: 'GITHUB', status: 'RUNNING' }),
    })
    expect(getInstallationOctokit).toHaveBeenCalledTimes(1)
  })

  it('logs failed project count in the final summary when a project SyncJob fails', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      { id: 'p1', name: 'project-health-dashboard', repositories: [repo] },
    ] as never)
    vi.mocked(db.syncJob.update)
      .mockRejectedValueOnce(new Error('failed to mark sync job successful'))
      .mockResolvedValueOnce({} as never)

    await main()

    expect(db.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'failed to mark sync job successful',
        itemsProcessed: 0,
      }),
    })
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining(
        '0 project(s) succeeded, 1 failed | 0 PRs, 0 commits, 0 weeks recomputed'
      )
    )
    expect(logger.info).toHaveBeenCalledWith(
      'Check the SyncJob table for FAILED entries to see which projects need to be re-run.'
    )
  })

  it('throws immediately when GitHub app credentials are not set', async () => {
    delete process.env.GITHUB_APP_ID
    delete process.env.GITHUB_APP_PRIVATE_KEY

    await expect(main()).rejects.toThrow(
      'GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set in environment variables'
    )
  })
})
