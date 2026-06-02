import { db, Prisma } from '@repo/db'
import { hasRole } from '@/lib/auth'
import {
  resolveGithubIdentity,
  resolveDiscordIdentity,
  IdentityResolutionError,
} from '@/lib/identity/resolve'
import { addMemberSchema } from '@/lib/schemas/admin'
import type { AddProjectMemberResponse } from '@/lib/project-members/types'

// API route for getting all members of a project
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  const { slug } = await params

  try {
    const members = await db.projectMember.findMany({
      where: {
        isActive: true,
        project: { slug },
      },
      include: {
        person: {
          include: { identities: true },
        },
      },
    })
    return Response.json(members, { status: 200 })
  } catch (error) {
    console.error('Error fetching members:', error)
    return Response.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

type ResolvedIdentities = {
  githubExternalId: string | null
  githubUsername: string | null
  discordSnowflake: string | null
  discordUsername: string | null
}

async function resolveIdentities(githubId: string, discordId: string): Promise<ResolvedIdentities> {
  let githubExternalId: string | null = null
  let githubUsername: string | null = null
  let discordSnowflake: string | null = null
  let discordUsername: string | null = null

  if (githubId) {
    const resolved = await resolveGithubIdentity(githubId)
    githubExternalId = resolved.externalId
    githubUsername = resolved.username
  }

  if (discordId) {
    const resolved = await resolveDiscordIdentity(discordId)
    discordSnowflake = resolved.externalId
    discordUsername = resolved.username
  }

  return { githubExternalId, githubUsername, discordSnowflake, discordUsername }
}

type NewPersonData = {
  displayName: string
  imageUrl: string | null
  discordSnowflake: string | null
  discordUsername: string | null
  githubExternalId: string | null
  githubUsername: string | null
}

async function createPersonWithIdentities(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  data: NewPersonData
): Promise<string> {
  const identitiesToCreate: {
    provider: 'DISCORD' | 'GITHUB'
    externalId: string
    username?: string
  }[] = []

  if (data.discordSnowflake && data.discordUsername) {
    identitiesToCreate.push({
      provider: 'DISCORD',
      externalId: data.discordSnowflake,
      username: data.discordUsername,
    })
  }

  if (data.githubExternalId && data.githubUsername) {
    identitiesToCreate.push({
      provider: 'GITHUB',
      externalId: data.githubExternalId,
      username: data.githubUsername,
    })
  }

  const newPerson = await tx.person.create({
    data: {
      displayName: data.displayName,
      identities: { create: identitiesToCreate },
      imageUrl: data.imageUrl,
    },
  })

  return newPerson.id
}

async function linkPersonToProject(
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0],
  slug: string,
  personId: string,
  displayName: string
): Promise<AddProjectMemberResponse> {
  const project = await tx.project.findUnique({
    where: { slug },
    select: { id: true },
  })

  if (!project) throw new Error('Project not found')

  const existingMember = await tx.projectMember.findFirst({
    where: { projectId: project.id, personId },
  })

  if (existingMember) {
    if (existingMember.isActive) {
      return {
        outcome: 'already_member',
        message: 'This person is already an active member of this project',
      }
    }
    const member = await tx.projectMember.update({
      where: { id: existingMember.id },
      data: { isActive: true, displayName },
      include: { person: true },
    })
    return { outcome: 'member_linked', member }
  }

  const member = await tx.projectMember.create({
    data: { projectId: project.id, personId, displayName, isActive: true },
    include: { person: true },
  })
  return { outcome: 'member_linked', member }
}

function findExistingIdentity(provider: 'DISCORD' | 'GITHUB', username: string) {
  return db.personIdentity.findFirst({
    where: { provider, username: { equals: username, mode: 'insensitive' } },
    select: { personId: true },
  })
}

function errorToStatus(message: string): number {
  if (message === 'Project not found') return 404
  return 500
}

// API route for adding a member to a project
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { slug } = await params
    const formData = await request.formData()

    const rawData = {
      personId: String(formData.get('personId') ?? '').trim() || undefined,
      displayName: String(formData.get('displayName') ?? '').trim() || undefined,
      discordId: String(formData.get('discordId') ?? '').trim() || undefined,
      githubId: String(formData.get('githubId') ?? '').trim() || undefined,
      imageUrl: String(formData.get('imageUrl') ?? '').trim() || undefined,
    }

    const parsed = addMemberSchema.safeParse(rawData)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    let targetPersonId = parsed.data.personId ?? ''
    let targetDisplayName = parsed.data.displayName ?? ''
    const discordId = parsed.data.discordId ?? ''
    const githubId = parsed.data.githubId ?? ''
    const imageUrl = parsed.data.imageUrl ?? ''

    if (targetPersonId) {
      const existingPerson = await db.person.findUnique({ where: { id: targetPersonId } })
      if (!existingPerson) {
        return Response.json(
          { error: 'Selected person could not be found in the database' },
          { status: 404 }
        )
      }
      targetDisplayName = existingPerson.displayName
    } else if (!targetDisplayName) {
      return Response.json({ error: 'Display name is required for a new person' }, { status: 400 })
    } else {
      // for looking up existing identities when adding through CSV with no personId
      const [existingGithubIdentity, existingDiscordIdentity] = await Promise.all([
        githubId ? findExistingIdentity('GITHUB', githubId) : null,
        discordId ? findExistingIdentity('DISCORD', discordId) : null,
      ])

      if (
        existingGithubIdentity &&
        existingDiscordIdentity &&
        existingGithubIdentity.personId !== existingDiscordIdentity.personId
      ) {
        return Response.json(
          {
            error: 'The provided GitHub and Discord accounts belong to different existing people.',
          },
          { status: 409 }
        )
      }

      if (existingGithubIdentity) {
        targetPersonId = existingGithubIdentity.personId
      } else if (existingDiscordIdentity) {
        targetPersonId = existingDiscordIdentity.personId
      }
    }

    const { githubExternalId, githubUsername, discordSnowflake, discordUsername } =
      await resolveIdentities(githubId, discordId)

    const newMemberResult = await db.$transaction(async (tx) => {
      if (!targetPersonId) {
        targetPersonId = await createPersonWithIdentities(tx, {
          displayName: targetDisplayName,
          imageUrl: imageUrl || null,
          discordSnowflake,
          discordUsername,
          githubExternalId,
          githubUsername,
        })
      }

      return linkPersonToProject(tx, slug, targetPersonId, targetDisplayName)
    })

    return Response.json(newMemberResult, {
      status: newMemberResult.outcome === 'already_member' ? 200 : 201,
    })
  } catch (error) {
    console.error('Error adding member:', error)

    if (error instanceof IdentityResolutionError) {
      return Response.json({ error: error.message }, { status: error.status })
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return Response.json(
        {
          error:
            'This GitHub or Discord account is already linked to another person. Select them from the existing people list instead.',
        },
        { status: 409 }
      )
    }

    const errorMessage = error instanceof Error ? error.message : 'Failed to add member'
    return Response.json({ error: errorMessage }, { status: errorToStatus(errorMessage) })
  }
}
