// Finds the commits for each non-main branch in a repo and stores it in a database.

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

  const branches = await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/branches', {
      owner: repo.owner,
      repo: repo.name,
      per_page: 100,
    })
  )

  let totalCommits = 0

  for (const branch of branches) {
    if (branch.name === 'main' || branch.name === 'master') {
      continue
    }

    logger.info(`Fetching commits for branch ${branch.name} of ${repo.owner}/${repo.name}`)

    const commits = await withRateLimit(() =>
      octokit.paginate('GET /repos/{owner}/{repo}/commits', {
        owner: repo.owner,
        repo: repo.name,
        sha: branch.name,
        since: weekStart.toISOString(),
        until: weekEnd.toISOString(),
        per_page: 100,
      })
    )

    totalCommits += commits.length

    for (const commit of commits) {
      await upsertCommit(repo, octokit, commit.sha, branch.name)
    }
  }

  if (totalCommits === 0) {
    logger.info(`No commits found for ${repo.owner}/${repo.name} in the past week.`)
  }

  return totalCommits
}
