// Fetches merged PRs for the week and stores them in the database.

import { db } from '@repo/db'
import { getInstallationOctokit } from '../lib/github-auth'
import { logger } from '../lib/logger'
import { resolveIdentity } from './github-utils'
import { withRateLimit } from './github-utils'

export async function ingestRepoMergedPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  logger.info(
    `Fetching merged PRs for ${repo.owner}/${repo.name} from ${weekStart.toISOString()} to ${weekEnd.toISOString()}`
  )

  const octokit = await getInstallationOctokit(repo.installationId)

  // GitHub's search syntax supports optional time information in the format THH:MM:SS+00:00
  // The times need to be included to ensure we capture all PRs merged until Sunday 23:59:59, not Sunday 00:00:00
  const since = weekStart.toISOString().replace('Z', '+00:00')
  const until = weekEnd.toISOString().replace('Z', '+00:00')
  const mergedThisWeek = await withRateLimit(() =>
    octokit.paginate('GET /search/issues', {
      q: `repo:${repo.owner}/${repo.name} is:pr is:merged merged:${since}..${until}`,
      per_page: 100,
    })
  )

  if (mergedThisWeek.length === 0) {
    logger.info(`No merged PRs found for ${repo.owner}/${repo.name} this week.`)
    return 0
  }

  let count = 0
  for (const pr of mergedThisWeek) {
    // Fetch full PR details to get additions/deletions
    const { data: fullPr } = await withRateLimit(() =>
      octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: repo.owner,
        repo: repo.name,
        pull_number: pr.number,
      })
    )

    const [authorIdentityId, mergedByIdentityId] = await Promise.all([
      fullPr.user ? resolveIdentity({ id: fullPr.user.id, login: fullPr.user.login }, repo) : null,
      fullPr.merged_by
        ? resolveIdentity({ id: fullPr.merged_by.id, login: fullPr.merged_by.login }, repo)
        : null,
    ])

    await db.pRFact.upsert({
      where: { repoId_number: { repoId: repo.id, number: fullPr.number } },
      create: {
        repoId: repo.id,
        number: fullPr.number,
        authorIdentityId,
        mergedByIdentityId,
        title: fullPr.title,
        body: fullPr.body ?? null,
        url: fullPr.html_url,
        labels: fullPr.labels.map((l) => l.name),
        createdAt: new Date(fullPr.created_at),
        mergedAt: fullPr.merged_at ? new Date(fullPr.merged_at) : null,
        closedAt: fullPr.closed_at ? new Date(fullPr.closed_at) : null,
        linesAdded: fullPr.additions,
        linesRemoved: fullPr.deletions,
        ingestedAt: new Date(),
      },
      update: {
        title: fullPr.title,
        body: fullPr.body ?? null,
        url: fullPr.html_url,
        labels: fullPr.labels.map((l) => l.name),
        authorIdentityId,
        mergedByIdentityId,
        mergedAt: fullPr.merged_at ? new Date(fullPr.merged_at) : null,
        closedAt: fullPr.closed_at ? new Date(fullPr.closed_at) : null,
        linesAdded: fullPr.additions,
        linesRemoved: fullPr.deletions,
        ingestedAt: new Date(),
      },
    })
    count++
  }

  logger.info(`Saved ${count} merged PRs for ${repo.owner}/${repo.name}.`)
  return count
}
