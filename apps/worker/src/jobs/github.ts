import { db } from '@repo/db'
import { logger } from '../lib/logger'
import { ingestRepoCommits } from '../lib/github-commit-tracker'
import { ingestRepoPRs } from '../lib/github-PR-tracker'
import { computeWeeklyGitHubMetrics } from '../lib/github-weekly-stats'
import { getCollectionWindow } from '../lib/date-utils'

export async function runGitHubIngestion(weekStart: Date, weekEnd: Date): Promise<void> {
  const projects = await db.project.findMany({
    where: { isActive: true },
    select: {
      id: true,
      repositories: true,
    },
  })

  const projectsWithRepos = projects.filter((p) => p.repositories.length > 0)
  let grandTotal = 0

  // Previous week window — stats are recomputed for both weeks so late-arriving
  // commits from the lookback period are reflected correctly.
  const [prevWeekStart, prevWeekEnd] = getCollectionWindow(
    new Date(weekEnd.getTime() - 7 * 24 * 60 * 60 * 1000)
  )

  for (const project of projectsWithRepos) {
    const syncJob = await db.syncJob.create({
      data: { type: 'GITHUB', projectId: project.id, status: 'RUNNING', startedAt: new Date() },
    })

    let totalProcessed = 0
    try {
      for (const repo of project.repositories) {
        try {
          const PRcount = await ingestRepoPRs(repo, weekStart, weekEnd)
          totalProcessed += PRcount
        } catch (err) {
          logger.error(`Failed to ingest PRs for ${repo.owner}/${repo.name}: ${err}`)
        }

        try {
          const commitCount = await ingestRepoCommits(repo)
          totalProcessed += commitCount
        } catch (err) {
          logger.error(`Failed to ingest commits for ${repo.owner}/${repo.name}: ${err}`)
        }
      }

      await computeWeeklyGitHubMetrics(project, prevWeekStart, prevWeekEnd)
      await computeWeeklyGitHubMetrics(project, weekStart, weekEnd)

      await db.syncJob.update({
        where: { id: syncJob.id },
        data: { status: 'SUCCESS', finishedAt: new Date(), itemsProcessed: totalProcessed },
      })
      grandTotal += totalProcessed
    } catch (err) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(err) },
      })
      throw err
    }
  }

  logger.info(`GitHub ingestion complete. ${grandTotal} items processed.`)
}
