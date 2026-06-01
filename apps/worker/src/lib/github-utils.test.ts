import { db, IdentityProvider, UnmatchedIdentity } from '@repo/db'
import { resolveIdentity, withRateLimit } from './github-utils'
import { logger } from './logger'

describe('GitHub Utils', () => {
  describe('withRateLimit', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('retries on primary rate limit (429) and waits the correct duration before retrying', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 30
      const mockFn = vi.fn()

      mockFn.mockRejectedValueOnce({
        status: 429,
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': resetTime.toString(),
          },
        },
      })
      mockFn.mockResolvedValueOnce('success')

      const waitSpy = vi.spyOn(global, 'setTimeout')
      const resultPromise = withRateLimit(mockFn, 3)
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(waitSpy).toHaveBeenCalledWith(expect.any(Function), 30_000)

      const waitDuration = waitSpy.mock.calls[0][1] as number
      expect(waitDuration).toBeGreaterThanOrEqual(10_000)
    })

    it('retries on secondary rate limit (403 with retry-after)', async () => {
      const mockFn = vi.fn()

      mockFn.mockRejectedValueOnce({
        status: 403,
        response: {
          headers: {
            'retry-after': '30',
          },
        },
      })
      mockFn.mockResolvedValueOnce('success')

      const waitSpy = vi.spyOn(global, 'setTimeout')
      const resultPromise = withRateLimit(mockFn, 3)
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(waitSpy).toHaveBeenCalledWith(expect.any(Function), 30_000)

      const waitDuration = waitSpy.mock.calls[0][1] as number
      expect(waitDuration).toBeGreaterThanOrEqual(10_000)
    })

    it('falls back to 60s wait when rate-limit error has no timing header', async () => {
      const mockFn = vi.fn()

      mockFn.mockRejectedValueOnce({
        status: 429,
        response: {
          headers: {},
        },
      })
      mockFn.mockResolvedValueOnce('success')

      const waitSpy = vi.spyOn(global, 'setTimeout')
      const resultPromise = withRateLimit(mockFn, 3)
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(waitSpy).toHaveBeenCalledWith(expect.any(Function), 60_000)
    })

    it('retries as a primary rate limit when 403 has x-ratelimit-remaining: 0', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 30
      const mockFn = vi.fn()

      mockFn.mockRejectedValueOnce({
        status: 403,
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': resetTime.toString(),
          },
        },
      })
      mockFn.mockResolvedValueOnce('success')

      const waitSpy = vi.spyOn(global, 'setTimeout')
      const resultPromise = withRateLimit(mockFn, 3)
      await vi.runAllTimersAsync()

      const result = await resultPromise

      expect(result).toBe('success')
      expect(mockFn).toHaveBeenCalledTimes(2)
      expect(waitSpy).toHaveBeenCalledWith(expect.any(Function), 30_000)

      const waitDuration = waitSpy.mock.calls[0][1] as number
      expect(waitDuration).toBeGreaterThanOrEqual(10_000)
    })

    it('throws immediately without retrying on non-rate-limit errors (500)', async () => {
      const mockFn = vi.fn()
      mockFn.mockRejectedValueOnce({ status: 500, response: { headers: {} } })

      const resultPromise = withRateLimit(mockFn, 3)
      const assertion = expect(resultPromise).rejects.toMatchObject({ status: 500 })
      await vi.runAllTimersAsync()
      await assertion

      expect(mockFn).toHaveBeenCalledTimes(1)
    })

    it('logs "permission denied" and throws without retrying on plain 403 (no rate-limit headers)', async () => {
      const mockFn = vi.fn()
      const loggerSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})

      mockFn.mockRejectedValueOnce({ status: 403, response: { headers: {} } })

      const resultPromise = withRateLimit(mockFn, 3)
      const assertion = expect(resultPromise).rejects.toMatchObject({ status: 403 })
      await vi.runAllTimersAsync()
      await assertion

      expect(mockFn).toHaveBeenCalledTimes(1)
      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Permission denied'))

      loggerSpy.mockRestore()
    })

    it('throws error after exhausting retries', async () => {
      const resetTime = Math.floor(Date.now() / 1000) + 30
      const mockFn = vi.fn()

      mockFn.mockRejectedValue({
        status: 429,
        response: {
          headers: {
            'x-ratelimit-remaining': '0',
            'x-ratelimit-reset': resetTime.toString(),
          },
        },
      })

      const resultPromise = withRateLimit(mockFn, 3)
      const assertion = expect(resultPromise).rejects.toMatchObject({ status: 429 })
      await vi.runAllTimersAsync()
      await assertion

      expect(mockFn).toHaveBeenCalledTimes(4)
    })
  })

  describe('resolveIdentity', () => {
    const mockPersonIdentity = {
      id: '1',
      personId: '1',
      provider: IdentityProvider.GITHUB,
      externalId: '1',
      username: 'test',
    }

    const mockUser = {
      id: 1,
      login: 'mock-login',
    }

    const mockDate = new Date('2026-06-01T00:00:00.000Z')

    beforeEach(() => {
      vi.setSystemTime(mockDate)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('returns the existing identity ID if the user is already known', async () => {
      vi.mocked(db.personIdentity.findUnique).mockResolvedValueOnce(mockPersonIdentity)

      const result = await resolveIdentity(mockUser)

      expect(result).toBe(mockPersonIdentity.id)
    })

    it('creates an UnmatchedIdentity record and returns null for unknown users', async () => {
      vi.mocked(db.personIdentity.findUnique).mockResolvedValueOnce(null)
      vi.mocked(db.unmatchedIdentity.upsert).mockResolvedValueOnce({} as UnmatchedIdentity)

      const result = await resolveIdentity(mockUser)

      expect(db.unmatchedIdentity.upsert).toHaveBeenCalledWith({
        where: { provider_externalId: { provider: 'GITHUB', externalId: String(mockUser.id) } },
        create: {
          provider: 'GITHUB',
          externalId: String(mockUser.id),
          username: mockUser.login,
          firstSeenAt: mockDate,
          lastSeenAt: mockDate,
          sampleRepoName: undefined,
        },
        update: {
          lastSeenAt: mockDate,
          username: mockUser.login,
          sampleRepoName: undefined,
        },
      })
      expect(result).toBeNull()
    })

    it('returns null gracefully when passed a null user', async () => {
      const result = await resolveIdentity(null)
      expect(result).toBeNull()
    })
  })
})
