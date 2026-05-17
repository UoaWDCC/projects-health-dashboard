// Finds the commits unique to each non-default branch in a repo and stores them in the database.

import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { logger } from '../lib/logger'
import { resolveIdentity } from './github-utils'
import { withRateLimit } from './github-utils'

type Octokit = Awaited<ReturnType<typeof getInstallationOctokit>>

// Fetches full commit details (for stats and author) and upserts a CommitFact row.
// Dedup is handled by the (repoId, sha) unique constraint.
export async function upsertCommit(
  repo: { id: string; owner: string; name: string },
  octokit: Octokit,
  sha: string,
  branch: string | null
): Promise<void> {
  const { data } = await withRateLimit(() =>
    octokit.request('GET /repos/{owner}/{repo}/commits/{sha}', {
      owner: repo.owner,
      repo: repo.name,
      sha,
    })
  )

  const authorIdentityId = await resolveIdentity(
    data.author ? { id: data.author.id, login: data.author.login } : null,
    repo
  )

  await db.commitFact.upsert({
    // compound key to avoid duplicate entries for the same commit
    where: { repoId_sha: { repoId: repo.id, sha } },
    create: {
      repoId: repo.id,
      sha,
      authorIdentityId,
      message: data.commit.message,
      branch,
      linesAdded: data.stats?.additions || 0,
      linesRemoved: data.stats?.deletions || 0,
      committedAt: new Date(data.commit.author?.date || Date.now()),
      ingestedAt: new Date(Date.now()),
    },
    update: {
      authorIdentityId,
      message: data.commit.message,
      linesAdded: data.stats?.additions || 0,
      linesRemoved: data.stats?.deletions || 0,
      committedAt: new Date(data.commit.author?.date || Date.now()),
      ingestedAt: new Date(Date.now()),
    },
  })
}

export async function ingestRepoCommits(
  repo: {
    id: string
    owner: string
    name: string
    installationId: string
  },
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  logger.info(`Fetching commits for ${repo.owner}/${repo.name}`)

  const octokit = await getInstallationOctokit(repo.installationId)

  const { data: repoData } = await withRateLimit(() =>
    octokit.request('GET /repos/{owner}/{repo}', {
      owner: repo.owner,
      repo: repo.name,
    })
  )
  const defaultBranch = repoData.default_branch

  const branches = await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/branches', {
      owner: repo.owner,
      repo: repo.name,
      per_page: 100,
    })
  )

  let totalCommits = 0
  const weekStartMs = weekStart.getTime()
  const weekEndMs = weekEnd.getTime()

  for (const branch of branches) {
    if (branch.name === defaultBranch) {
      continue
    }

    logger.info(`Fetching commits for branch ${branch.name} of ${repo.owner}/${repo.name}`)

    // Compare endpoint returns commits reachable from head but NOT from base,
    // so commits inherited from the default branch (e.g. via merge or rebase) are excluded.
    type CompareCommit = { sha: string; commit: { author?: { date?: string } | null } }
    const basehead = `${defaultBranch}...${branch.name}`
    const commits = await withRateLimit<CompareCommit[]>(() =>
      octokit.paginate(
        'GET /repos/{owner}/{repo}/compare/{basehead}',
        {
          owner: repo.owner,
          repo: repo.name,
          basehead,
          per_page: 100,
        },
        (response: { data: { commits: CompareCommit[] } }) => response.data.commits
      )
    )

    // GitHub's compare endpoint caps data.commits at 250 regardless of pagination.
    if (commits.length >= 250) {
      logger.warn(
        `Compare endpoint returned ${commits.length} commits for ${repo.owner}/${repo.name} ${basehead} — may be truncated at GitHub's 250-commit cap.`
      )
    }

    const inWindow = commits.filter((commit) => {
      const dateStr = commit.commit?.author?.date
      if (!dateStr) return false
      const t = new Date(dateStr).getTime()
      return t >= weekStartMs && t <= weekEndMs
    })

    totalCommits += inWindow.length

    for (const commit of inWindow) {
      await upsertCommit(repo, octokit, commit.sha, branch.name)
    }
  }

  if (totalCommits === 0) {
    logger.info(`No commits found for ${repo.owner}/${repo.name} in the past week.`)
  }

  return totalCommits
}
