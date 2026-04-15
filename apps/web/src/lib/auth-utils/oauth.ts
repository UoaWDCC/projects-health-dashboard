'use server'

import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

// Initiates the Google OAuth flow

export async function signInWithGoogle() {
  const supabase = await createClient()
  const headersList = await headers()
  const origin =
    headersList.get('origin') ?? process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    const params = new URLSearchParams({ error: 'oauth_start_failed' })
    if (error?.message) {
      params.set('error_description', error.message)
    }
    redirect(`/signin?${params.toString()}`)
  }

  redirect(data.url)
}
