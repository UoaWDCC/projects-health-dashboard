// Finds the commits for each non-main branch in a repo and stores it in a database.

import { db } from '@repo/db'
import { getInstallationOctokit } from '../lib/github-auth'
import { logger } from '../lib/logger'
import { resolveIdentity } from '../jobs/github'
import { withRateLimit } from '../jobs/github'
import { getWeekStart } from '../jobs/github'

export async function ingestRepoCommits(repo: {
  id: string
  owner: string
  name: string
  installationId: string
}): Promise<number> {
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
    if (branch.name === 'main') {
      continue
    }

    logger.info(`Fetching commits for branch ${branch.name} of ${repo.owner}/${repo.name}`)

    const commits = await withRateLimit(() =>
      octokit.paginate('GET /repos/{owner}/{repo}/commits', {
        owner: repo.owner,
        repo: repo.name,
        sha: branch.name,
        since: getWeekStart().toISOString(),
        per_page: 100,
      })
    )

    totalCommits += commits.length

    for (const commit of commits) {
      const authorIdentityId = await resolveIdentity(
        commit.author ? { id: commit.author.id, login: commit.author.login } : null,
        repo
      )

      await db.commitFact.upsert({
        // compound key to avoid duplicate entries for the same commit
        where: { repoId_sha: { repoId: repo.id, sha: commit.sha } },
        create: {
          repoId: repo.id,
          sha: commit.sha,
          authorIdentityId: authorIdentityId,
          message: commit.commit.message,
          branch: branch.name,
          linesAdded: commit.stats?.additions || 0,
          linesRemoved: commit.stats?.deletions || 0,
          committedAt: new Date(commit.commit.author?.date || Date.now()),
          ingestedAt: new Date(Date.now()),
        },
        update: {
          authorIdentityId: authorIdentityId,
          message: commit.commit.message,
          branch: branch.name,
          linesAdded: commit.stats?.additions || 0,
          linesRemoved: commit.stats?.deletions || 0,
          committedAt: new Date(commit.commit.author?.date || Date.now()),
          ingestedAt: new Date(Date.now()),
        },
      })
    }
  }

  if (totalCommits === 0) {
    logger.info(`No commits found for ${repo.owner}/${repo.name} in the past week.`)
  }

  return totalCommits
}
