import { createClient } from '@/lib/supabase/client'

type ImageBucket = 'project-images' | 'person-images'

export async function uploadImage(
  bucket: ImageBucket,
  entityId: string,
  file: File
): Promise<string> {
  const supabase = createClient()
  const path = `${entityId}/image`

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  })

  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)

  return data.publicUrl
}
