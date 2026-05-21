/**
 * One-time backfill script: populates historical GitHub PR and commit data for all active projects.
 *
 * The weekly cron job (jobs/github.ts) only collects data within the previous week's window.
 * This script fetches all PRs and branch commits from the given start date, then groups them
 * into weekly buckets. After raw facts are loaded, WeeklyStats and MemberWeeklyContribution
 * are recomputed for every distinct week that the data spans.
 *
 * Run with:
 *   pnpm backfill:github:dev
 *   pnpm backfill:github:prod
 *   pnpm backfill:github:dev -- --from YYYY-MM-DD [--to YYYY-MM-DD]
 *   pnpm backfill:github:prod -- --from YYYY-MM-DD [--to YYYY-MM-DD]
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

async function backfillRepoPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  octokit: Octokit,
  fromDate: Date,
  toDate: Date
): Promise<{ prCount: number; commitCount: number; weekStarts: Set<string> }> {
  logger.info(`  Fetching all PRs for ${repo.owner}/${repo.name}`)

  // Use list-pulls (not search API) to avoid the 1000-result cap.
  // GitHub's list-pulls endpoint has no date filter, so we filter in memory below.
  const allPRs = (await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/pulls', {
      owner: repo.owner,
      repo: repo.name,
      state: 'all',
      per_page: 100,
    })
  )) as ListedPR[]

  // inlcuding all open PRs, merged PRs, and closed-unmerged PRs
  const relevantPRs = allPRs.filter((pr) => {
    if (pr.merged_at) return new Date(pr.merged_at) >= fromDate
    if (pr.state === 'closed' && pr.closed_at) return new Date(pr.closed_at) >= fromDate
    return true // commits dated outside range are filtered below
  })

  logger.info(`  ${relevantPRs.length} relevant PR(s) for ${repo.owner}/${repo.name}`)

  // Fetch all non-main branches once.
  const allBranches = (
    await withRateLimit(() =>
      octokit.paginate('GET /repos/{owner}/{repo}/branches', {
        owner: repo.owner,
        repo: repo.name,
        per_page: 100,
      })
    )
  ).filter((b: { name: string }) => b.name !== 'main' && b.name !== 'master')

  logger.info(`  ${allBranches.length} non-main branch(es)`)

  const weekStarts = new Set<string>()
  let prCount = 0
  let commitCount = 0

  // ── Pass 1: All relevant PRs ──────────────
  // Using the PR commits API covers deleted branches (GitHub preserves commits after deletion).
  for (const pr of relevantPRs) {
    const { data: fullPr } = (await withRateLimit(() =>
      octokit.request('GET /repos/{owner}/{repo}/pulls/{pull_number}', {
        owner: repo.owner,
        repo: repo.name,
        pull_number: pr.number,
      })
    )) as { data: Awaited<ReturnType<Octokit['rest']['pulls']['get']>>['data'] }

    // Upsert PRFact only for PRs merged within [fromDate, toDate).
    if (fullPr.merged_at) {
      const mergedAt = new Date(fullPr.merged_at)
      if (mergedAt >= fromDate && mergedAt < toDate) {
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
            labels: fullPr.labels.map((l: { name: string }) => l.name),
            authorIdentityId,
            mergedByIdentityId,
            mergedAt,
            closedAt: fullPr.closed_at ? new Date(fullPr.closed_at) : null,
            linesAdded: fullPr.additions,
            linesRemoved: fullPr.deletions,
            ingestedAt: new Date(),
          },
        })

        prCount++
        weekStarts.add(getCollectionWindow(mergedAt)[0].toISOString())
      }
    }

    // Fetch all commits for this PR, then filter into [fromDate, toDate) in memory.
    let prCommits: PRCommit[] = []
    try {
      prCommits = (await withRateLimit(() =>
        octokit.paginate('GET /repos/{owner}/{repo}/pulls/{pull_number}/commits', {
          owner: repo.owner,
          repo: repo.name,
          pull_number: fullPr.number,
          per_page: 100,
        })
      )) as PRCommit[]
    } catch (err) {
      logger.error(`    Failed to fetch commits for PR #${pr.number}: ${err}`)
      continue
    }

    for (const commit of prCommits) {
      const authorDate = commit.commit.author?.date
      if (!authorDate) continue
      const d = new Date(authorDate)
      if (d < fromDate || d >= toDate) continue

      try {
        await upsertCommit(repo, octokit, commit.sha, fullPr.head.ref)
        commitCount++
        weekStarts.add(getCollectionWindow(d)[0].toISOString())
      } catch (err) {
        logger.error(`    Failed to upsert commit ${commit.sha} from PR #${pr.number}: ${err}`)
      }
    }
  }

  // ── Pass 2: All branches ─────────────
  // Fetch all commits since fromDate; filter to [fromDate, toDate) in memory.
  // No `until` filter — a branch may be created after toDate but contain earlier commits.
  for (const branch of allBranches) {
    const commits = (await withRateLimit(() =>
      octokit.paginate('GET /repos/{owner}/{repo}/commits', {
        owner: repo.owner,
        repo: repo.name,
        sha: branch.name,
        since: fromDate.toISOString(),
        per_page: 100,
      })
    )) as PRCommit[]

    for (const commit of commits) {
      const authorDate = commit.commit.author?.date
      if (!authorDate) continue
      const d = new Date(authorDate)
      if (d >= toDate) continue

      try {
        await upsertCommit(repo, octokit, commit.sha, branch.name)
        commitCount++
        weekStarts.add(getCollectionWindow(d)[0].toISOString())
      } catch (err) {
        logger.error(`    Failed to upsert commit ${commit.sha} from branch ${branch.name}: ${err}`)
      }
    }
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
