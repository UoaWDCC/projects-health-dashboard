import { db } from '@repo/db'
import { getInstallationOctokit } from '../lib/github-auth'
import { logger } from '../lib/logger'

/**
 * Minimal GitHub ingestion checkpoint.
 * Verifies that each active repository can be accessed via its stored
 * GitHub App installation before the full ingestion logic is built out.
 */
export async function runGitHubIngestion(): Promise<void> {
  const repositories = await db.gitHubRepository.findMany({
    where: {
      project: {
        isActive: true,
      },
    },
    include: {
      project: true,
    },
    orderBy: [{ owner: 'asc' }, { name: 'asc' }],
  })

  if (repositories.length === 0) {
    logger.warn('GitHub ingestion skipped: no active repositories configured')
    return
  }

  logger.info(`GitHub ingestion auth check starting for ${repositories.length} repositories`)

  let successCount = 0

  for (const repository of repositories) {
    try {
      const octokit = (await getInstallationOctokit(repository.installationId)) as {
        request: (
          route: string,
          parameters: Record<string, string>
        ) => Promise<{ data: { full_name?: string; default_branch?: string } }>
      }

      const response = await octokit.request('GET /repos/{owner}/{repo}', {
        owner: repository.owner,
        repo: repository.name,
      })

      successCount += 1
      logger.info(
        `GitHub auth verified for ${response.data.full_name ?? `${repository.owner}/${repository.name}`} (${repository.project.name}) on branch ${response.data.default_branch ?? 'unknown'}`
      )
    } catch (error) {
      logger.error(
        `GitHub auth check failed for ${repository.owner}/${repository.name} (${repository.project.name})`,
        error
      )
    }
  }

  logger.info(
    `GitHub ingestion auth check finished: ${successCount}/${repositories.length} repositories accessible`
  )
}
