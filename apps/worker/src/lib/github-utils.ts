// Utility functions for GitHub integration, including rate limit handling and identity resolution.

import { db } from '@repo/db'
import { logger } from '../lib/logger'

export async function withRateLimit<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status
      const headers = (err as { response?: { headers?: Record<string, string> } })?.response
        ?.headers

      const isPrimaryRateLimit =
        status === 429 || (status === 403 && headers?.['x-ratelimit-remaining'] === '0')
      const isSecondaryRateLimit =
        status === 403 && !isPrimaryRateLimit && headers?.['retry-after'] !== undefined

      const rateLimitReset = headers?.['x-ratelimit-reset']
      const retryAfter = headers?.['retry-after']

      let retryAfterSeconds = 60 // default retry after 60 seconds if not specified

      if (isPrimaryRateLimit && rateLimitReset) {
        const resetTime = parseInt(rateLimitReset, 10) * 1000
        const currentTime = Date.now()
        retryAfterSeconds = Math.max(Math.ceil((resetTime - currentTime) / 1000), 10)
      } else if (isSecondaryRateLimit && retryAfter) {
        retryAfterSeconds = Math.max(parseInt(retryAfter, 10), 10)
      }

      if ((isPrimaryRateLimit || isSecondaryRateLimit) && attempt < retries) {
        logger.warn(
          `Rate limit hit. Retrying after ${retryAfterSeconds}s (attempt ${attempt + 1}/${retries})`
        )
        await new Promise((r) => setTimeout(r, retryAfterSeconds * 1000))
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

export async function resolveIdentity(
  user: { id: number; login: string } | null,
  repo?: { id: string; owner: string; name: string } | null
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
      sampleRepoName: repo ? `${repo.owner}/${repo.name}` : undefined,
    },
    update: {
      lastSeenAt: new Date(),
      username: user.login,
      sampleRepoName: repo ? `${repo.owner}/${repo.name}` : undefined,
    },
  })

  return null
}
