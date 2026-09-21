import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { MAX_IMAGE_BYTES, updatePersonSchema } from '@/lib/schemas/admin'
import {
  ImageValidationError,
  assertValidImage,
  deleteImage,
  getImageUrl,
  uploadImage,
} from '@/lib/storage'

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
    // Held back until the transaction commits — see the comment where it is assigned.
    let pendingImage: File | null = null

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

      if (imageFile instanceof File && imageFile.size > 0) {
        // Reject an unusable file before anything else happens, so a bad upload never reaches
        // storage and never reports as a server error.
        try {
          assertValidImage(imageFile)
        } catch (error) {
          if (error instanceof ImageValidationError) {
            return Response.json({ error: error.message }, { status: error.status })
          }
          throw error
        }

        // Uploading overwrites the existing object at a fixed path, so doing it here would
        // destroy the current image even if the transaction below fails. The public URL is
        // derivable from the path, so persist the URL first and upload once the write commits.
        pendingImage = imageFile
        imageUrl = await getImageUrl('person-images', personId)
      } else if (removeImage) {
        imageUrl = null
        if (oldPerson.imageUrl) {
          deleteOldImage = true
        }
      }
    } else {
      let body: unknown
      try {
        body = await request.json()
      } catch {
        return Response.json({ error: 'Request body is not valid JSON' }, { status: 400 })
      }

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

    if (pendingImage) {
      try {
        await uploadImage('person-images', personId, pendingImage)
      } catch (error) {
        // The row now points at an image that was never written. Put the previous URL back so the
        // record still matches what is actually in storage.
        console.error('Failed to store person image, reverting imageUrl:', error)
        try {
          await db.person.update({
            where: { id: personId },
            data: { imageUrl: oldPerson.imageUrl },
          })
        } catch (revertError) {
          console.error('Failed to revert person imageUrl after a failed upload:', revertError)
        }

        return Response.json(
          {
            error:
              'The person details were saved, but the image could not be stored. Please try uploading the image again.',
          },
          { status: 502 }
        )
      }
    }

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
    return Response.json({ error: 'Failed to update person' }, { status: 500 })
  }
}
