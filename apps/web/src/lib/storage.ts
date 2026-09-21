import { createClient } from '@/lib/supabase/server'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/schemas/admin'

type ImageBucket = 'project-images' | 'person-images'

/**
 * A rejected upload caused by the file the caller sent, not by storage being unavailable.
 * Routes map `status` straight onto the response so these never surface as a 500.
 */
export class ImageValidationError extends Error {
  constructor(
    message: string,
    readonly status: 413 | 415
  ) {
    super(message)
    this.name = 'ImageValidationError'
  }
}

/**
 * Checks a file without touching storage, so callers can reject bad input before performing
 * any side effects.
 */
export function assertValidImage(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new ImageValidationError(
      `Unsupported image type "${file.type || 'unknown'}". Allowed types: JPEG, PNG, WEBP.`,
      415
    )
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new ImageValidationError(
      `Image is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024}MB.`,
      413
    )
  }
}

/**
 * The public URL an image for `entityId` will have. The storage path is deterministic, so this
 * can be resolved before the bytes are uploaded — that lets a caller persist the URL first and
 * upload only once the write has committed.
 */
export async function getImageUrl(bucket: ImageBucket, entityId: string): Promise<string> {
  const supabase = await createClient()
  const { data } = supabase.storage.from(bucket).getPublicUrl(`${entityId}/image`)

  return data.publicUrl
}

export async function uploadImage(
  bucket: ImageBucket,
  entityId: string,
  file: File
): Promise<string> {
  assertValidImage(file)

  const supabase = await createClient()
  const path = `${entityId}/image`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })

  if (error) {
    console.error('Supabase storage upload failed:', {
      bucket,
      path,
      size: file.size,
      type: file.type,
      error,
    })
    throw new Error(`Failed to upload image: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  return data.publicUrl
}

export async function deleteImage(bucket: ImageBucket, entityId: string): Promise<void> {
  const supabase = await createClient()
  const path = `${entityId}/image`

  const { error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    console.error('Supabase storage delete failed:', { bucket, path, error })
    throw new Error(`Failed to delete image: ${error.message}`)
  }
}

export async function copyImage(
  bucket: ImageBucket,
  fromEntityId: string,
  toEntityId: string
): Promise<string> {
  const supabase = await createClient()
  const fromPath = `${fromEntityId}/image`
  const toPath = `${toEntityId}/image`

  const { error } = await supabase.storage.from(bucket).copy(fromPath, toPath)

  if (error) {
    console.error('Supabase storage copy failed:', { bucket, fromPath, toPath, error })
    throw new Error(`Failed to copy image: ${error.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(toPath)
  return data.publicUrl
}
