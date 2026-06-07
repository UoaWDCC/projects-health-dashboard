// Finds the commits unique to each non-default branch in a repo and stores them in the database.

import { db, Prisma } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { logger } from '../lib/logger'
import { resolveIdentity, withRateLimit } from './github-utils'

type Octokit = Awaited<ReturnType<typeof getInstallationOctokit>>

// Fetches full commit details (for stats and author) and inserts a CommitFact row.
// Checks the DB first to skip the GitHub API call for already-known SHAs.
// branch is set only on first insert and never overwritten.
// Returns true if the commit was newly inserted, false if it already existed.
export async function upsertCommit(
  repo: { id: string; owner: string; name: string },
  octokit: Octokit,
  sha: string,
  branch: string | null
): Promise<boolean> {
  const existing = await db.commitFact.findUnique({
    where: { repoId_sha: { repoId: repo.id, sha } },
    select: { sha: true },
  })
  if (existing) return false

  const { data } = await withRateLimit(() =>
    octokit.request('GET /repos/{owner}/{repo}/commits/{sha}', {
      owner: repo.owner,
      repo: repo.name,
      sha,
    })
  )

  const authorIdentityId = await resolveIdentity(
    data.author ? { id: data.author.id, login: data.author.login } : null,
    repo
  )

  try {
    await db.commitFact.create({
      data: {
        repoId: repo.id,
        sha,
        authorIdentityId,
        message: data.commit.message,
        branch,
        linesAdded: data.stats?.additions || 0,
        linesRemoved: data.stats?.deletions || 0,
        committedAt: new Date(data.commit.author?.date || Date.now()),
        ingestedAt: new Date(),
      },
    })
    return true
  } catch (err) {
    // Two concurrent ingestions can both pass the findUnique check and race to insert
    // the same SHA. Treat the unique constraint violation as a no-op.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return false
    }
    throw err
  }
}

export async function ingestRepoCommits(repo: {
  id: string
  owner: string
  name: string
  installationId: string
}): Promise<number> {
  logger.info(`Fetching commits for ${repo.owner}/${repo.name}`)

  const octokit = await getInstallationOctokit(repo.installationId)

  const { data: repoData } = await withRateLimit(() =>
    octokit.request('GET /repos/{owner}/{repo}', {
      owner: repo.owner,
      repo: repo.name,
    })
  )
  const defaultBranch = repoData.default_branch

  const branches = await withRateLimit(() =>
    octokit.paginate('GET /repos/{owner}/{repo}/branches', {
      owner: repo.owner,
      repo: repo.name,
      per_page: 100,
    })
  )

  let totalCommits = 0

  for (const branch of branches) {
    if (branch.name === defaultBranch) {
      continue
    }

    logger.info(`Fetching commits for branch ${branch.name} of ${repo.owner}/${repo.name}`)

    // Compare endpoint returns commits reachable from head but NOT from base,
    // so commits inherited from the default branch (e.g. via merge or rebase) are excluded.
    type CompareCommit = { sha: string }
    const basehead = `${defaultBranch}...${branch.name}`
    const commits = await withRateLimit<CompareCommit[]>(() =>
      octokit.paginate(
        'GET /repos/{owner}/{repo}/compare/{basehead}',
        {
          owner: repo.owner,
          repo: repo.name,
          basehead,
          per_page: 100,
        },
        (response: { data: { commits: CompareCommit[] } }) => response.data.commits
      )
    )

    // GitHub's compare endpoint caps data.commits at 250 regardless of pagination.
    if (commits.length >= 250) {
      logger.warn(
        `Compare endpoint returned ${commits.length} commits for ${repo.owner}/${repo.name} ${basehead} — may be truncated at GitHub's 250-commit cap.`
      )
    }

    for (const commit of commits) {
      if (await upsertCommit(repo, octokit, commit.sha, branch.name)) {
        totalCommits++
      }
    }
  }

  if (totalCommits === 0) {
    logger.info(`No new commits found for ${repo.owner}/${repo.name}.`)
  }

  return totalCommits
}
