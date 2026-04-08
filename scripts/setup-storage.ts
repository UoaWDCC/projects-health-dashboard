import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const buckets = [
  { name: 'project-images', public: true },
  { name: 'person-images', public: true },
]

async function main() {
  for (const bucket of buckets) {
    const { data: existing, error: getError } = await supabase.storage.getBucket(bucket.name)

    if (existing) {
      console.log(`Bucket "${bucket.name}" already exists, skipping.`)
      continue
    }

    if (getError && !getError.message.toLowerCase().includes('not found')) {
      console.error(`Failed to check bucket "${bucket.name}":`, getError.message)
      process.exit(1)
    }

    const { error } = await supabase.storage.createBucket(bucket.name, {
      public: bucket.public,
    })

    if (error) {
      console.error(`Failed to create bucket "${bucket.name}":`, error.message)
      process.exit(1)
    }

    console.log(`Created bucket "${bucket.name}".`)
  }
}

main()
