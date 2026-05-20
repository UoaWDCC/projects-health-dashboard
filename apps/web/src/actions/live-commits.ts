'use server'

import { db } from '@repo/db'

export async function getLatestLiveCommits() {
  return await db.liveCommit.findMany({
    orderBy: { committedAt: 'desc' },
    take: 10,
  })
}

export async function getProjectSlugs() {
  const projects = await db.project.findMany({
    select: { id: true, slug: true },
  })

  // Return as a record mapping ID to slug for O(1) lookups on the client
  return projects.reduce(
    (acc, project) => {
      acc[project.id] = project.slug
      return acc
    },
    {} as Record<string, string>
  )
}
