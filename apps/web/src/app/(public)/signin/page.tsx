import { signInWithGoogle } from '@/lib/auth-utils/oauth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const authErrorMessages: Record<string, string> = {
  auth: 'Authentication failed. Please try again.',
  invalid_client: 'Google OAuth client is invalid or missing. Check provider credentials.',
  access_denied: 'Sign-in was canceled or denied.',
  missing_code: 'Sign-in response was incomplete. Please try again.',
  oauth_start_failed: 'Could not start Google sign-in. Please retry.',
  session_exchange_failed: 'Could not complete sign-in. Please retry.',
  unexpected_auth_error: 'Unexpected auth error. Please try again.',
}

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; error_description?: string }>
}) {
  const { error, error_description } = await searchParams
  const errorMessage = (error && authErrorMessages[error]) || error_description || null

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-muted/40 to-background px-4">
      <div className="flex w-full max-w-sm flex-col items-center gap-8">
        <h1 className="text-xl font-semibold tracking-tight">WDCC Project Health Board</h1>

        <Card className="w-full shadow-lg">
          <CardHeader className="pb-4 text-center">
            <CardTitle className="text-lg">Sign in to continue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-center text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            <form className="w-full">
              <button
                formAction={signInWithGoogle}
                className="flex w-full items-center justify-center gap-3 rounded-lg border bg-background px-5 py-3 text-sm font-medium shadow-sm transition-all hover:bg-muted hover:shadow-md active:scale-[0.98]"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
