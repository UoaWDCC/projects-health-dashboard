import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates a Supabase client for use in Client Components.
 * Call this inside a component or hook, not at module scope.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
