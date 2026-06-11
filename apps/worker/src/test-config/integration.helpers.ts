import { randomUUID } from 'node:crypto'
import { db } from '@repo/db'

export async function seedRepo() {
  const token = randomUUID().replace(/-/g, '').slice(0, 12)
  const project = await db.project.create({
    data: {
      name: `Test Project ${token}`,
      slug: `test-project-${token}`,
      description: 'Test project',
    },
  })

  return db.gitHubRepository.create({
    data: {
      projectId: project.id,
      owner: `org-${token}`,
      name: `project-${token}`,
      installationId: '123456',
    },
  })
}

export async function seedIdentity(externalId: number, username: string) {
  const person = await db.person.create({
    data: {
      displayName: username,
    },
  })

  return db.personIdentity.create({
    data: {
      personId: person.id,
      provider: 'GITHUB',
      externalId: String(externalId),
      username,
    },
  })
}

export async function seedProjectWithRepo() {
  const repo = await seedRepo()
  const project = await db.project.findUniqueOrThrow({ where: { id: repo.projectId } })
  return { project, repo }
}

export async function seedPersonWithIdentity(
  username: string,
  externalId = Math.floor(Math.random() * 1_000_000)
) {
  const identity = await seedIdentity(externalId, username)
  const person = await db.person.findUniqueOrThrow({ where: { id: identity.personId } })
  return { person, identity }
}

export async function seedProjectMember(projectId: string, personId: string) {
  return db.projectMember.create({
    data: { projectId, personId },
  })
}

export async function seedCommitFact(
  repoId: string,
  identityId: string | null,
  opts: {
    sha?: string
    linesAdded?: number
    linesRemoved?: number
    committedAt?: Date
    branch?: string | null
  } = {}
) {
  return db.commitFact.create({
    data: {
      repoId,
      sha: opts.sha ?? randomUUID().replace(/-/g, '').slice(0, 16),
      authorIdentityId: identityId,
      message: 'Test commit',
      branch: opts.branch === undefined ? 'feature-branch' : opts.branch,
      linesAdded: opts.linesAdded ?? 0,
      linesRemoved: opts.linesRemoved ?? 0,
      committedAt: opts.committedAt ?? new Date('2026-05-05T10:00:00Z'),
    },
  })
}

export async function seedPRFact(
  repoId: string,
  identityId: string | null,
  opts: {
    number?: number
    mergedAt?: Date
  } = {}
) {
  return db.pRFact.create({
    data: {
      repoId,
      number: opts.number ?? Math.floor(Math.random() * 100_000),
      authorIdentityId: identityId,
      title: 'Test PR',
      createdAt: new Date('2026-05-04T09:00:00Z'),
      mergedAt: opts.mergedAt ?? new Date('2026-05-06T12:00:00Z'),
    },
  })
}
