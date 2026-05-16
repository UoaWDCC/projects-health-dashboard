/**
 * One-time backfill script: populates historical GitHub PR and commit data for all active projects.
 *
 * The weekly cron job (jobs/github.ts) only collects data within the previous week's window.
 * This script walks all merged PRs within the given date range for each project's repos, extracts
 * their commits, and upserts CommitFact and PRFact rows. After raw facts are loaded, WeeklyStats
 * and MemberWeeklyContribution are recomputed for every distinct week that the data spans.
 *
 * Run with:
 *   pnpm backfill:github:dev
 *   pnpm backfill:github:prod
 *   pnpm backfill:github:dev -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *   pnpm backfill:github:prod -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *
 * --from  Start of the merged-at range (inclusive, UTC midnight). Required.
 * --to    End of the merged-at range (inclusive, UTC end-of-day). Defaults to today.
 */

import { db, SyncJobStatus, SyncJobType } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { logger } from '../apps/worker/src/lib/logger'
import { upsertCommit } from '../apps/worker/src/lib/github-commit-tracker'
import { resolveIdentity, withRateLimit } from '../apps/worker/src/lib/github-utils'
import { computeWeeklyGitHubMetrics } from '../apps/worker/src/lib/github-weekly-stats'
import { getCollectionWindow } from '../apps/worker/src/lib/date-utils'

type Octokit = Awaited<ReturnType<typeof getInstallationOctokit>>

// Minimal shapes for the paginated Octokit responses we consume.
type ListedPR = { number: number; merged_at: string | null }
type PRCommit = { sha: string; commit: { author: { date: string } | null } }

function parseDateRange(): { fromDate: Date; toDate: Date } {
  const args = process.argv.slice(2)
  let fromStr: string | null = null
  let toStr: string | null = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from' && args[i + 1]) fromStr = args[++i]
    else if (args[i] === '--to' && args[i + 1]) toStr = args[++i]
  }

  if (!fromStr) {
    throw new Error('Usage: pnpm backfill:github:[dev|prod] -- --from YYYY-MM-DD [--to YYYY-MM-DD]')
  }

  const fromDate = new Date(`${fromStr}T00:00:00.000Z`)
  const toDate = toStr ? new Date(`${toStr}T23:59:59.999Z`) : new Date()

  if (isNaN(fromDate.getTime())) throw new Error(`Invalid --from date: ${fromStr}`)
  if (toStr && isNaN(toDate.getTime())) throw new Error(`Invalid --to date: ${toStr}`)

  return { fromDate, toDate }
}

/**
 * Paginates all closed PRs for a repo, filters for merged PRs within the date range,
 * upserts PRFact and each PR's CommitFact rows, and collects affected week starts.
 */
async function backfillRepoMergedPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  octokit: Octokit,
  fromDate: Date,
  toDate: Date
): Promise<{ prCount: number; commitCount: number; weekStarts: Set<string> }> {
  logger.info(
    `  Fetching closed PRs for ${repo.owner}/${repo.name} (${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)})`
  )

  // Use list-pulls endpoint (not search API) to avoid the 1000-result search cap.
  const closedPRs = (await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
      owner: repo.owner,
      repo: repo.name,
      state: 'closed',
      per_page: 100,
    })
  )) as ListedPR[]

  const mergedInRange = closedPRs.filter((pr) => {
    if (!pr.merged_at) return false
    const mergedAt = new Date(pr.merged_at)
    return mergedAt >= fromDate && mergedAt <= toDate
  })

  logger.info(`  ${mergedInRange.length} merged PR(s) in range for ${repo.owner}/${repo.name}`)

  const weekStarts = new Set<string>()
  let prCount = 0
  let commitCount = 0

  for (const pr of mergedInRange) {
    // Fetch full PR details to get additions/deletions (not included in list response).
    const { data: fullPr } = (await withRateLimit(() =>
      octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: repo.owner,
        repo: repo.name,
        pull_number: pr.number,
      })
    )) as { data: Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data'] }

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
        labels: fullPr.labels.map((l: { name: string }) => l.name),
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
        labels: fullPr.labels.map((l: { name: string }) => l.name),
        authorIdentityId,
        mergedByIdentityId,
        mergedAt: fullPr.merged_at ? new Date(fullPr.merged_at) : null,
        closedAt: fullPr.closed_at ? new Date(fullPr.closed_at) : null,
        linesAdded: fullPr.additions,
        linesRemoved: fullPr.deletions,
        ingestedAt: new Date(),
      },
    })

    prCount++

    if (fullPr.merged_at) {
      const [prWeekStart] = getCollectionWindow(new Date(fullPr.merged_at))
      weekStarts.add(prWeekStart.toISOString())
    }

    // Fetch and upsert each commit from this PR.
    try {
      const prCommits = (await withRateLimit(() =>
        octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
          owner: repo.owner,
          repo: repo.name,
          pull_number: fullPr.number,
          per_page: 100,
        })
      )) as PRCommit[]

      for (const commit of prCommits) {
        // Bucket this commit into the week it was authored — committedAt drives week attribution.
        const authorDate = commit.commit.author?.date
        if (authorDate) {
          const [commitWeekStart] = getCollectionWindow(new Date(authorDate))
          weekStarts.add(commitWeekStart.toISOString())
        }

        try {
          await upsertCommit(repo, octokit, commit.sha, fullPr.head.ref)
          commitCount++
        } catch (err) {
          logger.error(
            `    Failed to upsert commit ${commit.sha} from PR #${fullPr.number} in ${repo.owner}/${repo.name}: ${err}`
          )
        }
      }
    } catch (err) {
      logger.error(
        `    Failed to fetch commits for PR #${fullPr.number} in ${repo.owner}/${repo.name}: ${err}`
      )
    }
  }

  logger.info(`  → ${prCount} PRs, ${commitCount} commits upserted for ${repo.owner}/${repo.name}`)

  return { prCount, commitCount, weekStarts }
}

async function main() {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GITHUB_APP_ID and GITHUB_APP_PRIVATE_KEY must be set in environment variables')
  }

  const { fromDate, toDate } = parseDateRange()

  logger.info(
    `GitHub backfill range: ${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)}`
  )

  const projects = await db.project.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      repositories: {
        select: { id: true, owner: true, name: true, installationId: true },
      },
    },
  })

  logger.info(`Starting GitHub historical backfill for ${projects.length} active project(s)`)

  for (const project of projects) {
    if (project.repositories.length === 0) {
      logger.info(`Skipping project "${project.name}" — no repositories configured`)
      continue
    }

    logger.info(`Project "${project.name}": processing ${project.repositories.length} repo(s)`)

    const syncJob = await db.syncJob.create({
      data: {
        type: SyncJobType.GITHUB,
        projectId: project.id,
        status: SyncJobStatus.RUNNING,
        startedAt: new Date(),
      },
    })

    let totalPRs = 0
    let totalCommits = 0
    const allWeekStarts = new Set<string>()

    try {
      for (const repo of project.repositories) {
        logger.info(`  Repo ${repo.owner}/${repo.name}`)
        try {
          const octokit = await getInstallationOctokit(repo.installationId)
          const result = await backfillRepoMergedPRs(repo, octokit, fromDate, toDate)
          totalPRs += result.prCount
          totalCommits += result.commitCount
          for (const ws of result.weekStarts) allWeekStarts.add(ws)
        } catch (err) {
          logger.error(`  Failed to backfill repo ${repo.owner}/${repo.name}: ${err}`)
        }
      }

      // Sort weeks chronologically and recompute metrics for each.
      const sortedWeekStarts = [...allWeekStarts]
        .map((iso) => new Date(iso))
        .sort((a, b) => a.getTime() - b.getTime())

      logger.info(
        `  Recomputing WeeklyStats for ${sortedWeekStarts.length} week(s) in project "${project.name}"`
      )

      for (const weekStart of sortedWeekStarts) {
        const [, weekEnd] = getCollectionWindow(weekStart)
        try {
          await computeWeeklyGitHubMetrics(
            { id: project.id, repositories: project.repositories },
            weekStart,
            weekEnd
          )
          logger.info(`  Week ${weekStart.toISOString()} — metrics computed`)
        } catch (err) {
          logger.error(
            `  Failed to compute metrics for week ${weekStart.toISOString()} in project "${project.name}": ${err}`
          )
        }
      }

      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.SUCCESS,
          finishedAt: new Date(),
          itemsProcessed: totalPRs + totalCommits,
        },
      })

      logger.info(
        `Project "${project.name}" backfill complete: ${totalPRs} PRs, ${totalCommits} commits, ${sortedWeekStarts.length} weeks recomputed`
      )
    } catch (err) {
      await db.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: SyncJobStatus.FAILED,
          finishedAt: new Date(),
          errorMessage: (err as Error).message,
          itemsProcessed: totalPRs + totalCommits,
        },
      })
      logger.error(`Backfill failed for project "${project.name}": ${err}`)
    }
  }

  logger.info('GitHub historical backfill complete')
}

main()
  .catch((err: unknown) => {
    logger.error(`Fatal error in GitHub backfill script: ${err}`)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
