import { resolvePublicOrigin } from '@/lib/auth-utils/origin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// OAuth callback handler

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const origin = resolvePublicOrigin(request.headers, request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const providerError = searchParams.get('error') ?? searchParams.get('error_code')
  const providerErrorDescription = searchParams.get('error_description')

  if (providerError) {
    const params = new URLSearchParams({ error: providerError })
    if (providerErrorDescription) {
      params.set('error_description', providerErrorDescription)
    }

    return NextResponse.redirect(`${origin}/signin?${params.toString()}`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/signin?error=missing_code`)
  }

  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    const params = new URLSearchParams({ error: 'session_exchange_failed' })
    params.set('error_description', error.message)
    return NextResponse.redirect(`${origin}/signin?${params.toString()}`)
  } catch {
    return NextResponse.redirect(`${origin}/signin?error=unexpected_auth_error`)
  }
}
