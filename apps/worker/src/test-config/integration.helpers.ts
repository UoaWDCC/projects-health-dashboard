import { db } from '@repo/db'

export async function seedRepo() {
  const project = await db.project.create({
    data: { name: 'Test Project', slug: `test-project-${Date.now()}` },
  })
  const repo = await db.gitHubRepository.create({
    data: { projectId: project.id, owner: 'org', name: 'project', installationId: 'install-1' },
  })
  return repo
}

export async function seedIdentity(githubId: number, login: string) {
  const person = await db.person.create({ data: { displayName: login } })
  const identity = await db.personIdentity.create({
    data: {
      personId: person.id,
      provider: 'GITHUB',
      externalId: String(githubId),
      username: login,
    },
  })
  return identity
}
