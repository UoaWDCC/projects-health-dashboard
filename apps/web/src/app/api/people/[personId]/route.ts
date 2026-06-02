import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { updatePersonSchema } from '@/lib/schemas/admin'

export async function GET(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId } = await params
    const person = await db.person.findUnique({
      where: { id: personId },
      include: {
        identities: true,
        memberships: {
          include: {
            project: true, // Fetching project data to show project name in frontend
          },
        },
      },
    })

    if (!person) {
      return Response.json({ error: 'Person not found' }, { status: 404 })
    }

    return Response.json(person, { status: 200 })
  } catch (error) {
    console.error('Error fetching person details:', error)
    return Response.json({ error: 'Failed to fetch person details' }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  if (!(await hasRole('ADMIN'))) {
    return Response.json({ error: 'Unauthorized. Admin access required.' }, { status: 403 })
  }

  try {
    const { personId } = await params
    const body = await request.json()

    const parsed = updatePersonSchema.safeParse(body)
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? 'Invalid request'
      return Response.json({ error: message }, { status: 400 })
    }

    const { displayName, imageUrl, forceCascade } = parsed.data

    const oldPerson = await db.person.findUnique({
      where: { id: personId },
    })

    if (!oldPerson) {
      return Response.json({ error: 'Person not found' }, { status: 404 })
    }

    const updatedPerson = await db.$transaction(async (tx) => {
      const newDisplayName =
        displayName !== undefined ? String(displayName).trim() : oldPerson.displayName
      const newImageUrl =
        imageUrl !== undefined ? (imageUrl ? String(imageUrl).trim() : null) : oldPerson.imageUrl

      const person = await tx.person.update({
        where: { id: personId },
        data: {
          displayName: newDisplayName,
          imageUrl: newImageUrl,
        },
      })

      // If the display name changed, trigger cascade
      if (displayName !== undefined && newDisplayName !== oldPerson.displayName) {
        if (forceCascade) {
          // Force overwrite all project member display names
          await tx.projectMember.updateMany({
            where: { personId },
            data: { displayName: newDisplayName },
          })
        } else {
          // Only cascade to memberships that haven't been customized
          // i.e., they match the old global name, or are null/empty
          await tx.projectMember.updateMany({
            where: {
              personId,
              OR: [
                { displayName: null },
                { displayName: '' },
                { displayName: oldPerson.displayName },
              ],
            },
            data: { displayName: newDisplayName },
          })
        }
      }

      return person
    })

    return Response.json(updatedPerson, { status: 200 })
  } catch (error) {
    console.error('Error updating person:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update person' },
      { status: 500 }
    )
  }
}
