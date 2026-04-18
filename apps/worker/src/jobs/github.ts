import { db } from '@repo/db'
import { logger } from '../lib/logger'
import { ingestRepoCommits } from '../lib/github-commit-tracker'
import { ingestRepoMergedPRs } from '../lib/github-PR-tracker'
import { computeWeeklyGitHubMetrics } from '../lib/github-weekly-stats'

export async function runGitHubIngestion(weekStart: Date): Promise<void> {
  const syncJob = await db.syncJob.create({
    data: { type: 'GITHUB', status: 'RUNNING', startedAt: new Date() },
  })

  try {
    const repos = await db.gitHubRepository.findMany()
    let totalProcessed = 0

    for (const repo of repos) {
      try {
        const PRcount = await ingestRepoMergedPRs(repo, weekStart)
        totalProcessed += PRcount
      } catch (err) {
        logger.error(`Failed to ingest PRs for ${repo.owner}/${repo.name}: ${err}`)
      }

      try {
        const commitCount = await ingestRepoCommits(repo, weekStart)
        totalProcessed += commitCount
      } catch (err) {
        logger.error(`Failed to ingest commits for ${repo.owner}/${repo.name}: ${err}`)
      }
    }

    await computeWeeklyGitHubMetrics(weekStart)

    await db.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'SUCCESS', finishedAt: new Date(), itemsProcessed: totalProcessed },
    })
    logger.info(`GitHub ingestion complete. ${totalProcessed} items processed.`)
  } catch (err) {
    await db.syncJob.update({
      where: { id: syncJob.id },
      data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(err) },
    })
    throw err
  }
}
