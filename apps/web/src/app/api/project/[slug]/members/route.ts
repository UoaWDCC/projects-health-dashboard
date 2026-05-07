import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'

// API route for getting all members of a project
export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  try {
    const members = await db.projectMember.findMany({
      where: {
        isActive: true,
        project: {
          slug,
        },
      },
      include: {
        person: {
          include: {
            identities: true,
          },
        },
      },
    })
    return Response.json(members, { status: 200 })
  } catch (error) {
    console.error('Error fetching members:', error)
    return Response.json({ error: 'Failed to fetch members' }, { status: 500 })
  }
}

// API route for adding a member to a project
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { slug } = await params
    const formData = await request.formData()

    let targetPersonId = String(formData.get('personId') ?? '').trim()
    let targetDisplayName = String(formData.get('displayName') ?? '').trim()
    const discordId = String(formData.get('discordId') ?? '').trim()
    const githubId = String(formData.get('githubId') ?? '').trim()
    const imageUrl = String(formData.get('imageUrl') ?? '').trim()

    if (!targetPersonId) {
      if (!targetDisplayName) {
        return Response.json(
          { error: 'Display name is required for a new person' },
          { status: 400 }
        )
      }
    } else {
      const existingPerson = await db.person.findUnique({
        where: { id: targetPersonId },
      })

      if (!existingPerson) {
        return Response.json(
          { error: 'Selected person could not be found in the database' },
          { status: 404 }
        )
      }
      targetDisplayName = existingPerson.displayName
    }

    const newMember = await db.$transaction(async (tx) => {
      // Scenario 2: Create a brand new person (No personId provided)
      if (!targetPersonId) {
        // Construct identities array
        const identitiesToCreate: {
          provider: 'DISCORD' | 'GITHUB'
          externalId: string
          username?: string
        }[] = []
        if (discordId) {
          identitiesToCreate.push({ provider: 'DISCORD', externalId: discordId })
        }
        if (githubId) {
          identitiesToCreate.push({ provider: 'GITHUB', externalId: githubId, username: githubId })
        }

        const newPerson = await tx.person.create({
          data: {
            displayName: targetDisplayName,
            identities: {
              create: identitiesToCreate,
            },
            imageUrl: imageUrl || null,
          },
        })
        targetPersonId = newPerson.id
      }

      const project = await tx.project.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (!project) {
        throw new Error('Project not found')
      }

      // Prevent adding the exact same person to the project twice
      const existingMember = await tx.projectMember.findFirst({
        where: {
          projectId: project.id,
          personId: targetPersonId,
        },
      })

      if (existingMember) {
        if (existingMember.isActive) {
          throw new Error('This person is already an active member of this project!')
        } else {
          // Reactivate soft-deleted member!
          return await tx.projectMember.update({
            where: { id: existingMember.id },
            data: {
              isActive: true,
              displayName: targetDisplayName,
            },
            include: {
              person: true,
            },
          })
        }
      }

      // Scenario 1 & 2: Link the person to the project
      return await tx.projectMember.create({
        data: {
          projectId: project.id,
          personId: targetPersonId,
          displayName: targetDisplayName, // Explicitly overriding ProjectMember's displayName
          isActive: true,
        },
        include: {
          person: true,
        },
      })
    })

    return Response.json(newMember, { status: 201 })
  } catch (error) {
    console.error('Error adding member:', error)

    const errorMessage = error instanceof Error ? error.message : 'Failed to add member'
    const status =
      errorMessage === 'This person is already an active member of this project!'
        ? 409
        : errorMessage === 'Project not found'
          ? 404
          : 500

    return Response.json({ error: errorMessage }, { status })
  }
}
