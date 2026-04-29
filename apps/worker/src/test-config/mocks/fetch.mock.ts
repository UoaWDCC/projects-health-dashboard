import { mockFetch } from '../vitest.setup'

export function mockDiscordResponseWithHeaders(
  messages: object[],
  headers: Record<string, string> = {}
) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: (key: string) => headers[key] ?? null },
    json: async () => messages,
  })
}

export function mockDiscordRateLimit(retryAfter = 0.01) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status: 429,
    headers: { get: () => null },
    json: async () => ({ retry_after: retryAfter }),
  })
}

export function mockDiscordHttpError(status: number) {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    headers: { get: () => null },
    json: async () => ({}),
  })
}

export function mockDiscordEmpty() {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    headers: { get: () => null },
    json: async () => [],
  })
}
