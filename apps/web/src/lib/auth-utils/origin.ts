// Resolves the public origin for redirects, accounting for proxies like Fly.io
// that terminate TLS and forward to an internal port. Without this, redirects
// derived from `request.url` leak the internal `0.0.0.0:3000` host to the browser.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function stripTrailingSlash(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function hostnameOf(host: string): string {
  return host.split(':')[0]
}

function defaultProto(host: string): string {
  return LOCAL_HOSTS.has(hostnameOf(host)) ? 'http' : 'https'
}

export function resolvePublicOrigin(headers: Headers, fallbackUrl?: string): string {
  const forwardedHost = headers.get('x-forwarded-host')
  const forwardedProto = headers.get('x-forwarded-proto')

  if (forwardedHost) {
    const proto = forwardedProto ?? defaultProto(forwardedHost)
    return `${proto}://${forwardedHost}`
  }

  const host = headers.get('host')
  if (host) {
    const proto = forwardedProto ?? defaultProto(host)
    return `${proto}://${host}`
  }

  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL
  if (envOrigin) {
    return stripTrailingSlash(envOrigin)
  }

  if (fallbackUrl) {
    return new URL(fallbackUrl).origin
  }

  return 'http://localhost:3000'
}
