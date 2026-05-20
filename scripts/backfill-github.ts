/**
 * One-time backfill script: populates historical GitHub PR and commit data for all active projects.
 *
 * The weekly cron job (jobs/github.ts) only collects data within the previous week's window.
 * This script walks all PRs within the given date range for each project's repos, extracts
 * their commits, and upserts CommitFact and PRFact rows. After raw facts are loaded, WeeklyStats
 * and MemberWeeklyContribution are recomputed for every distinct week that the data spans.
 *
 * PR date attribution:
 *   - Merged PRs:              filtered and attributed by merged_at
 *   - Closed (unmerged) PRs:   filtered and attributed by closed_at
 *   - Open PRs:                filtered and attributed by created_at
 *
 * Run with:
 *   pnpm backfill:github:dev
 *   pnpm backfill:github:prod
 *   pnpm backfill:github:dev -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *   pnpm backfill:github:prod -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *
 * --from  Start date — snapped to Monday 00:00 UTC of the containing week. Required.
 * --to    End date   — snapped to Monday 00:00 UTC of the following week (exclusive). Defaults to today.
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
type ListedPR = {
  number: number
  state: string
  merged_at: string | null
  created_at: string
  closed_at: string | null
  head: { ref: string }
}
type PRCommit = { sha: string; commit: { author: { date: string } | null } }

// Returns all Monday week-starts in [fromDate, toDate).
// fromDate is assumed to already be snapped to a Monday.
function weeksInRange(fromDate: Date, toDate: Date): Date[] {
  const weeks: Date[] = []
  let current = new Date(fromDate)
  while (current < toDate) {
    weeks.push(new Date(current))
    current = new Date(current.getTime() + 7 * 24 * 60 * 60 * 1000)
  }
  return weeks
}

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

  const parsedFrom = new Date(`${fromStr}T00:00:00.000Z`)
  const parsedTo = toStr ? new Date(`${toStr}T00:00:00.000Z`) : new Date()

  if (isNaN(parsedFrom.getTime())) throw new Error(`Invalid --from date: ${fromStr}`)
  if (toStr && isNaN(parsedTo.getTime())) throw new Error(`Invalid --to date: ${toStr}`)

  // Snap to week boundaries — mirrors the discord backfill approach.
  // --from → Monday 00:00 UTC of the containing week
  // --to   → Monday 00:00 UTC of the following week (exclusive upper bound)
  const [fromDate] = getCollectionWindow(parsedFrom)
  const [toWeekStart] = getCollectionWindow(parsedTo)
  const toDate = new Date(toWeekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  if (fromDate > toDate) {
    throw new Error(`--from (${fromStr}) must be before --to (${toStr ?? 'today'})`)
  }

  return { fromDate, toDate }
}

/**
 * Two-pass per-week backfill for a single repo, mirroring the weekly collection job:
 *
 * Pass 1 (mirrors ingestRepoMergedPRs): for each week, find PRs merged in that week,
 *   upsert PRFact for each, then upsert all their commits to CommitFact.
 *
 * Pass 2 (mirrors ingestRepoCommits): for each week, scan all non-main branches with
 *   since/until to capture every commit authored in that week — including commits on
 *   branches whose PR hasn't been opened yet. Overlaps with Pass 1 are deduplicated
 *   by the (repoId, sha) unique constraint on CommitFact.
 */
async function backfillRepoPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  octokit: Octokit,
  fromDate: Date,
  toDate: Date
): Promise<{ prCount: number; commitCount: number; weekStarts: Set<string> }> {
  logger.info(
    `  Fetching all PRs for ${repo.owner}/${repo.name} (${fromDate.toISOString().slice(0, 10)} → ${toDate.toISOString().slice(0, 10)})`
  )

  // Use list-pulls endpoint (not search API) to avoid the 1000-result search cap.
  // Only merged PRs are needed for Pass 1 (PRFact).
  const allPRs = (await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      per_page: 100,
    })
  )) as ListedPR[]

  const mergedPRsInRange = allPRs.filter(
    (pr) => pr.merged_at && new Date(pr.merged_at) >= fromDate && new Date(pr.merged_at) < toDate
  )

  // Closed-unmerged PRs in range — needed for Pass 3.
  // Their branch may have been deleted, so Pass 2 branch scanning can't reach them.
  // We use the PR commits API instead, which preserves commits even after branch deletion.
  const closedUnmergedPRsInRange = allPRs.filter(
    (pr) =>
      pr.state === 'closed' &&
      !pr.merged_at &&
      pr.closed_at &&
      new Date(pr.closed_at) >= fromDate &&
      new Date(pr.closed_at) < toDate
  )

  logger.info(
    `  ${mergedPRsInRange.length} merged PR(s), ${closedUnmergedPRsInRange.length} closed-unmerged PR(s) in range for ${repo.owner}/${repo.name}`
  )

  // Fetch all non-main branches once — reused per week in Pass 2.
  const allBranches = (
    await withRateLimit(() =>
      octokit.paginate('GET /repos/{owner}/{repo}/branches', {
        owner: repo.owner,
        repo: repo.name,
        per_page: 100,
      })
    )
  ).filter((b: { name: string }) => b.name !== 'main' && b.name !== 'master')

  logger.info(`  ${allBranches.length} non-main branch(es) for Pass 2`)

  const weekStarts = new Set<string>()
  let prCount = 0
  let commitCount = 0

  for (const weekStart of weeksInRange(fromDate, toDate)) {
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    // ── Pass 1: PRs merged this week → PRFact + all their commits ──────────────
    const mergedThisWeek = mergedPRsInRange.filter(
      (pr) => new Date(pr.merged_at!) >= weekStart && new Date(pr.merged_at!) < weekEnd
    )

    for (const pr of mergedThisWeek) {
      const { data: fullPr } = (await withRateLimit(() =>
        octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
          owner: repo.owner,
          repo: repo.name,
          pull_number: pr.number,
        })
      )) as { data: Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data'] }

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
      weekStarts.add(weekStart.toISOString())

      const prCommits = (await withRateLimit(() =>
        octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
          owner: repo.owner,
          repo: repo.name,
          pull_number: fullPr.number,
          per_page: 100,
        })
      )) as PRCommit[]

      for (const commit of prCommits) {
        try {
          await upsertCommit(repo, octokit, commit.sha, fullPr.head.ref)
          commitCount++
          if (commit.commit.author?.date) {
            const [commitWeekStart] = getCollectionWindow(new Date(commit.commit.author.date))
            weekStarts.add(commitWeekStart.toISOString())
          }
        } catch (err) {
          logger.error(`    Failed to upsert commit ${commit.sha} from PR #${pr.number}: ${err}`)
        }
      }
    }

    // ── Pass 2: scan all branches for commits authored this week ───────────────
    let pass2Count = 0
    for (const branch of allBranches) {
      const commits = (await withRateLimit(() =>
        octokit.paginate('GET /repos/{owner}/{repo}/commits', {
          owner: repo.owner,
          repo: repo.name,
          sha: branch.name,
          since: weekStart.toISOString(),
          until: weekEnd.toISOString(),
          per_page: 100,
        })
      )) as { sha: string }[]

      for (const commit of commits) {
        try {
          await upsertCommit(repo, octokit, commit.sha, branch.name)
          commitCount++
          pass2Count++
          weekStarts.add(weekStart.toISOString())
        } catch (err) {
          logger.error(
            `    Failed to upsert commit ${commit.sha} from branch ${branch.name}: ${err}`
          )
        }
      }
    }

    // ── Pass 3: closed-unmerged PRs → commits authored this week ──────────────
    // Branch may be deleted, so we use the PR commits API (not branch scanning).
    // ingestRepoCommits does NOT cover this case — this is backfill-only coverage.
    let pass3Count = 0
    for (const pr of closedUnmergedPRsInRange) {
      let prCommits: PRCommit[] = []
      try {
        prCommits = (await withRateLimit(() =>
          octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
            owner: repo.owner,
            repo: repo.name,
            pull_number: pr.number,
            per_page: 100,
          })
        )) as PRCommit[]
      } catch (err) {
        logger.error(`    Failed to fetch commits for closed PR #${pr.number}: ${err}`)
        continue
      }

      for (const commit of prCommits) {
        const authorDate = commit.commit.author?.date
        if (!authorDate) continue
        const d = new Date(authorDate)
        if (d < weekStart || d >= weekEnd) continue

        try {
          await upsertCommit(repo, octokit, commit.sha, pr.head.ref)
          commitCount++
          pass3Count++
          weekStarts.add(weekStart.toISOString())
        } catch (err) {
          logger.error(
            `    Failed to upsert commit ${commit.sha} from closed PR #${pr.number}: ${err}`
          )
        }
      }
    }

    logger.info(
      `  Week ${weekStart.toISOString().slice(0, 10)}: Pass 1 — ${mergedThisWeek.length} merged PR(s) | Pass 2 — ${pass2Count} commit(s) from branches | Pass 3 — ${pass3Count} commit(s) from closed PRs`
    )
  }

  logger.info(
    `  → ${prCount} PRs upserted to PRFact, ${commitCount} commits upserted for ${repo.owner}/${repo.name}`
  )

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

  let grandTotalPRs = 0
  let grandTotalCommits = 0
  let grandTotalWeeks = 0
  let projectsSucceeded = 0
  let projectsFailed = 0

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
          const result = await backfillRepoPRs(repo, octokit, fromDate, toDate)
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

      grandTotalPRs += totalPRs
      grandTotalCommits += totalCommits
      grandTotalWeeks += sortedWeekStarts.length
      projectsSucceeded++

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
      projectsFailed++
      logger.error(`Backfill failed for project "${project.name}": ${err}`)
    }
  }

  logger.info(
    `GitHub historical backfill complete — ${projectsSucceeded} project(s) succeeded, ${projectsFailed} failed | ` +
      `${grandTotalPRs} PRs, ${grandTotalCommits} commits, ${grandTotalWeeks} weeks recomputed`
  )
  if (projectsFailed > 0) {
    logger.info(
      'Check the SyncJob table for FAILED entries to see which projects need to be re-run.'
    )
  }
}

main()
  .catch((err: unknown) => {
    logger.error(`Fatal error in GitHub backfill script: ${err}`)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
