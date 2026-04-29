import { Prisma, db } from '@repo/db'
import { logger } from './logger'

// Uses already-ingested live webhook commits as the source of line-change totals.

export async function getGitHubEditedLinesByContributor(
  repo: {
    id: string
    owner: string
    name: string
    installationId: string
  },
  weekStart: Date
): Promise<number> {
  logger.info(`Computing edited lines by contributor for ${repo.owner}/${repo.name}`)

  try {
    const rows = await db.$queryRaw<
      Array<{ username: string; linesAdded: bigint; linesRemoved: bigint }>
    >(Prisma.sql`
      SELECT
        lc."authorName" AS "username",
        COALESCE(SUM(lc."linesAdded"), 0) AS "linesAdded",
        COALESCE(SUM(lc."linesRemoved"), 0) AS "linesRemoved"
      FROM "LiveCommit" lc
      WHERE lc."repoOwner" = ${repo.owner}
        AND lc."repoName" = ${repo.name}
        AND lc."committedAt" >= ${weekStart}
        AND LOWER(lc."branch") NOT IN ('main', 'master')
      GROUP BY lc."authorName"
    `)

    let upsertCount = 0
    for (const row of rows) {
      const linesAdded = Number(row.linesAdded)
      const linesRemoved = Number(row.linesRemoved)

      await db.contributorWeeklyEditedLines.upsert({
        where: {
          username_repoId_weekStart: { username: row.username, repoId: repo.id, weekStart },
        },
        create: { username: row.username, repoId: repo.id, weekStart, linesAdded, linesRemoved },
        update: { linesAdded, linesRemoved, computedAt: new Date() },
      })
      upsertCount++
    }

    logger.info(
      `Computed edited lines for ${upsertCount} contributors in ${repo.owner}/${repo.name}`
    )
    return upsertCount
  } catch (err) {
    logger.error(`Failed to compute edited lines by contributor: ${err}`)
    throw err
  }
}
