// Fetches PRs across all statuses for the past 2 weeks and stores data in the database.

import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { logger } from '../lib/logger'
import { resolveIdentity, withRateLimit } from './github-utils'
import { upsertCommit } from './github-commit-tracker'
import { getCollectionWindow } from './date-utils'

// Searches all PRs (open, closed, merged) updated within a 2-week lookback window.
// PRFact rows are written only for PRs merged within the current week.
// Commits are captured for every PR regardless of status.
export async function ingestRepoPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  weekStart: Date,
  weekEnd: Date
): Promise<number> {
  // Lookback start = Monday of the previous week
  const [lookbackStart] = getCollectionWindow(new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000))
  const lookbackSince = lookbackStart.toISOString().slice(0, 10)
  const until = weekEnd.toISOString().slice(0, 10)

  logger.info(`Fetching all PRs for ${repo.owner}/${repo.name} from ${lookbackSince} to ${until}`)

  const octokit = await getInstallationOctokit(repo.installationId)

  const allPRs = await withRateLimit(() =>
    octokit.paginate('GET /search/issues', {
      q: `repo:${repo.owner}/${repo.name} is:pr updated:${lookbackSince}..${until}`,
      per_page: 100,
    })
  )

  if (allPRs.length === 0) {
    logger.info(`No PRs found for ${repo.owner}/${repo.name} in the past 2 weeks.`)
    return 0
  }

  let prFactCount = 0

  for (const pr of allPRs) {
    try {
      const { data: fullPr } = await withRateLimit(() =>
        octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
          owner: repo.owner,
          repo: repo.name,
          pull_number: pr.number,
        })
      )

      // Write PRFact only for PRs merged within the current week
      const mergedAt = fullPr.merged_at ? new Date(fullPr.merged_at) : null
      if (mergedAt && mergedAt >= weekStart && mergedAt <= weekEnd) {
        const [authorIdentityId, mergedByIdentityId] = await Promise.all([
          fullPr.user
            ? resolveIdentity({ id: fullPr.user.id, login: fullPr.user.login }, repo)
            : null,
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
            mergedAt,
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
            mergedAt,
            closedAt: fullPr.closed_at ? new Date(fullPr.closed_at) : null,
            linesAdded: fullPr.additions,
            linesRemoved: fullPr.deletions,
            ingestedAt: new Date(),
          },
        })
        prFactCount++
      }

      // Capture commits for all PRs regardless of status
      try {
        const prCommits = await withRateLimit(() =>
          octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
            owner: repo.owner,
            repo: repo.name,
            pull_number: fullPr.number,
            per_page: 100,
          })
        )

        for (const commit of prCommits) {
          try {
            await upsertCommit(repo, octokit, commit.sha, fullPr.head.ref)
          } catch (err) {
            logger.error(
              `Failed to upsert commit ${commit.sha} from PR #${fullPr.number} in ${repo.owner}/${repo.name}: ${err}`
            )
          }
        }
      } catch (err) {
        logger.error(
          `Failed to ingest commits for PR #${fullPr.number} in ${repo.owner}/${repo.name}: ${err}`
        )
      }
    } catch (err) {
      logger.error(`Failed to process PR #${pr.number} in ${repo.owner}/${repo.name}: ${err}`)
    }
  }

  logger.info(`Saved ${prFactCount} PRFacts for ${repo.owner}/${repo.name}.`)
  return prFactCount
}
