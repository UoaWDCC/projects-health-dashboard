import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { MAX_IMAGE_BYTES, updatePersonSchema } from '@/lib/schemas/admin'
import { deleteImage, uploadImage } from '@/lib/storage'

const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 1024 * 1024

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

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    return Response.json(
      { error: `Request too large. Maximum image size is ${MAX_IMAGE_BYTES / 1024 / 1024}MB` },
      { status: 413 }
    )
  }

  try {
    const { personId } = await params
    const contentType = request.headers.get('content-type') ?? ''

    const oldPerson = await db.person.findUnique({
      where: { id: personId },
    })

    if (!oldPerson) {
      return Response.json({ error: 'Person not found' }, { status: 404 })
    }

    let newDisplayName: string = oldPerson.displayName
    let forceCascade = false
    let imageUrl: string | null | undefined
    let deleteOldImage = false

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const displayNameRaw = formData.get('displayName')
      forceCascade = String(formData.get('forceCascade')) === 'true'

      if (displayNameRaw !== null) {
        newDisplayName = String(displayNameRaw).trim()
      }
      if (!newDisplayName) {
        return Response.json({ error: 'Display name cannot be empty' }, { status: 400 })
      }

      const imageFile = formData.get('image')
      const removeImage = String(formData.get('removeImage')) === 'true'

      try {
        if (imageFile instanceof File && imageFile.size > 0) {
          imageUrl = await uploadImage('person-images', personId, imageFile)
        } else if (removeImage) {
          imageUrl = null
          if (oldPerson.imageUrl) {
            deleteOldImage = true
          }
        }
      } catch (error) {
        console.error('Failed to update person image:', error)
        return Response.json(
          { error: error instanceof Error ? error.message : 'Failed to update person image' },
          { status: 500 }
        )
      }
    } else {
      const body = await request.json()
      const parsed = updatePersonSchema.safeParse(body)
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? 'Invalid request'
        return Response.json({ error: message }, { status: 400 })
      }
      const { displayName, imageUrl: imageUrlInput, forceCascade: cascade } = parsed.data
      if (displayName !== undefined) {
        newDisplayName = String(displayName).trim()
      }
      forceCascade = cascade ?? false
      if (imageUrlInput !== undefined) {
        imageUrl = imageUrlInput ? String(imageUrlInput).trim() : null
      }
    }

    const updatedPerson = await db.$transaction(async (tx) => {
      const person = await tx.person.update({
        where: { id: personId },
        data: {
          displayName: newDisplayName,
          ...(imageUrl !== undefined ? { imageUrl } : {}),
        },
      })

      // If the display name changed, trigger cascade
      if (newDisplayName !== oldPerson.displayName) {
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

    if (deleteOldImage) {
      try {
        await deleteImage('person-images', personId)
      } catch (error) {
        console.error('Failed to remove the previous person image:', error)
      }
    }

    return Response.json(updatedPerson, { status: 200 })
  } catch (error) {
    console.error('Error updating person:', error)
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to update person' },
      { status: 500 }
    )
  }
}
