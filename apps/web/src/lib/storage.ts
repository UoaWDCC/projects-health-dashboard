import { createClient } from '@/lib/supabase/server'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '@/lib/schemas/admin'

type ImageBucket = 'project-images' | 'person-images'

export async function uploadImage(
  bucket: ImageBucket,
  entityId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: JPEG, PNG, WEBP`)
  }

  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`File too large. Maximum size is ${MAX_IMAGE_BYTES / 1024 / 1024}MB`)
  }

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
