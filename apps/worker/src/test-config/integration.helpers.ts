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
