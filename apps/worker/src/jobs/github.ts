import { db } from '@repo/db'
import { getInstallationOctokit } from '../lib/github-auth'
import { logger } from '../lib/logger'
import { ingestRepoCommits } from '../lib/github-commit-tracker'

export async function withRateLimit<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const headers = (err as { response?: { headers?: Record<string, string> } })?.response
        ?.headers

      // 403 can mean permission denied OR secondary rate limit — check for retry-after header
      const isSecondaryRateLimit = status === 403 && headers?.['retry-after'] !== undefined
      const isPrimaryRateLimit = status === 429

      if (isPrimaryRateLimit && attempt < retries) {
        const retryAfter = parseInt(headers?.['retry-after'] ?? '60', 10)
        logger.warn(
          `Rate limit hit. Retrying after ${retryAfter}s (attempt ${attempt + 1}/${retries})`
        )
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        continue
      }

      if (isSecondaryRateLimit && attempt < retries) {
        const retryAfter = parseInt(headers['retry-after']!, 10)
        logger.warn(
          `Secondary rate limit hit. Retrying after ${retryAfter}s (attempt ${attempt + 1}/${retries})`
        )
        await new Promise((r) => setTimeout(r, retryAfter * 1000))
        continue
      }

      if (status === 403) {
        logger.error('Permission denied (403). Check GitHub App permissions or installation scope.')
      }

      throw err
    }
  }
  throw new Error('Unreachable')
}

export async function runGitHubIngestion(): Promise<void> {
  const syncJob = await db.syncJob.create({
    data: { type: 'GITHUB', status: 'RUNNING', startedAt: new Date() },
  })

  try {
    const weekStart = getWeekStart()
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
        const commitCount = await ingestRepoCommits(repo)
        totalProcessed += commitCount
      } catch (err) {
        logger.error(`Failed to ingest commits for ${repo.owner}/${repo.name}: ${err}`)
      }
    }

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

async function ingestRepoMergedPRs(
  repo: { id: string; owner: string; name: string; installationId: string },
  weekStart: Date
): Promise<number> {
  logger.info(`Fetching merged PRs for ${repo.owner}/${repo.name} since ${weekStart.toISOString()}`)

  const octokit = await getInstallationOctokit(repo.installationId)

  const since = weekStart.toISOString().split('T')[0] // YYYY-MM-DD
  const mergedThisWeek = await withRateLimit(() =>
    octokit.paginate('GET /search/issues', {
      q: `repo:${repo.owner}/${repo.name} is:pr is:merged merged:>=${since}`,
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

    const authorIdentityId = await resolveIdentity(
      fullPr.user ? { id: fullPr.user.id, login: fullPr.user.login } : null
    )
    const mergedByIdentityId = await resolveIdentity(
      fullPr.merged_by ? { id: fullPr.merged_by.id, login: fullPr.merged_by.login } : null
    )

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

export async function resolveIdentity(
  user: { id: number; login: string } | null
): Promise<string | null> {
  if (!user) return null

  const existing = await db.personIdentity.findUnique({
    where: { provider_externalId: { provider: 'GITHUB', externalId: String(user.id) } },
  })
  if (existing) return existing.id

  await db.unmatchedIdentity.upsert({
    where: { provider_externalId: { provider: 'GITHUB', externalId: String(user.id) } },
    create: {
      provider: 'GITHUB',
      externalId: String(user.id),
      username: user.login,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
    },
    update: { lastSeenAt: new Date(), username: user.login },
  })
  return null
}

export function getWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? 6 : day - 1 // days since Monday
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}
