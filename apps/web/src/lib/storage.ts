import { createClient } from '@/lib/supabase/server'

type ImageBucket = 'project-images' | 'person-images'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadImage(
  bucket: ImageBucket,
  entityId: string,
  file: File
): Promise<string> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed: JPEG, PNG, WEBP`)
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
  }

  const supabase = await createClient()
  const path = `${entityId}/image`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })

  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  return data.publicUrl
}
