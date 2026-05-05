'use server'

import { db } from '@repo/db'

export async function getLatestLiveCommits() {
  return await db.liveCommit.findMany({
    orderBy: { committedAt: 'desc' },
    take: 10,
  })
}
