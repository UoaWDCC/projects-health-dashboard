import { afterEach, describe, expect, it } from 'vitest'
import { resolvePublicOrigin } from './origin'

function makeHeaders(init: Record<string, string>): Headers {
  return new Headers(init)
}

describe('resolvePublicOrigin', () => {
  const originalEnv = process.env.NEXT_PUBLIC_SITE_URL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalEnv
    }
  })

  it('uses x-forwarded-host and x-forwarded-proto when present (Fly proxy)', () => {
    const headers = makeHeaders({
      'x-forwarded-host': 'wphd-prod.fly.dev',
      'x-forwarded-proto': 'https',
      host: '0.0.0.0:3000',
    })

    expect(resolvePublicOrigin(headers, 'http://0.0.0.0:3000/auth/callback')).toBe(
      'https://wphd-prod.fly.dev'
    )
  })

  it('defaults to https for non-local x-forwarded-host without proto', () => {
    const headers = makeHeaders({ 'x-forwarded-host': 'wphd-prod.fly.dev' })
    expect(resolvePublicOrigin(headers)).toBe('https://wphd-prod.fly.dev')
  })

  it('uses host header for local dev with http default', () => {
    const headers = makeHeaders({ host: 'localhost:3000' })
    expect(resolvePublicOrigin(headers)).toBe('http://localhost:3000')
  })

  it('respects x-forwarded-proto on host fallback', () => {
    const headers = makeHeaders({ host: 'wphd-prod.fly.dev', 'x-forwarded-proto': 'https' })
    expect(resolvePublicOrigin(headers)).toBe('https://wphd-prod.fly.dev')
  })

  it('falls back to NEXT_PUBLIC_SITE_URL when no host headers exist', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://wphd-prod.fly.dev/'
    const headers = makeHeaders({})
    expect(resolvePublicOrigin(headers)).toBe('https://wphd-prod.fly.dev')
  })

  it('falls back to the request URL origin when nothing else is available', () => {
    delete process.env.NEXT_PUBLIC_SITE_URL
    const headers = makeHeaders({})
    expect(resolvePublicOrigin(headers, 'http://0.0.0.0:3000/auth/callback')).toBe(
      'http://0.0.0.0:3000'
    )
  })
})
