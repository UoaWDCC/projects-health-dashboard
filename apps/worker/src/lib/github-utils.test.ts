import { db, IdentityProvider, UnmatchedIdentity } from '@repo/db'
import { resolveIdentity, withRateLimit } from './github-utils'

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
