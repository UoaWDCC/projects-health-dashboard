import { db } from '@repo/db'

// API route for getting all members of a project
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  try {
    const members = await db.projectMember.findMany({
      where: {
        isActive: true,
        projectId: projectId,
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
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params
    const formData = await request.formData()

    const personId = String(formData.get('personId') ?? '').trim()

    const newMember = await db.$transaction(async (tx) => {
      let targetPersonId = personId
      let targetDisplayName = ''

      // Scenario 2: Create a brand new person (No personId provided)
      if (!targetPersonId) {
        targetDisplayName = String(formData.get('displayName') ?? '').trim()
        const discordId = String(formData.get('discordId') ?? '').trim()
        const githubId = String(formData.get('githubId') ?? '').trim()

        if (!targetDisplayName) {
          throw new Error('Display name is required for a new person')
        }

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
          },
        })
        targetPersonId = newPerson.id
      } else {
        // Scenario 1: Existing person selected
        // We must fetch their display name to mirror it in ProjectMember
        const existingPerson = await tx.person.findUnique({
          where: { id: targetPersonId },
        })

        if (!existingPerson) {
          throw new Error('Selected person could not be found in the database')
        }

        targetDisplayName = existingPerson.displayName
      }

      // Prevent adding the exact same person to the project twice
      const existingMember = await tx.projectMember.findFirst({
        where: {
          projectId,
          personId: targetPersonId,
        },
      })

      if (existingMember) {
        throw new Error('This person is already a member of this project!')
      }

      // Scenario 1 & 2: Link the person to the project
      return await tx.projectMember.create({
        data: {
          projectId: projectId,
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
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to add member' },
      { status: error instanceof Error && error.message.includes('required') ? 400 : 500 }
    )
  }
}
