import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { mockFetch } from '../test-config/vitest.setup'
import { runDiscordIngestion, requestMessages, timestampToSnowflake } from './discord'

function mockMessagesResponse(messages: unknown[]) {
  return {
    ok: true,
    status: 200,
    headers: {
      get: (h: string) => {
        if (h === 'X-RateLimit-Remaining') return '5'
        if (h === 'X-RateLimit-Reset-After') return '0'
        return null
      },
    },
    json: () => Promise.resolve(messages),
  }
}

function mockErrorResponse(status: number) {
  return {
    ok: false,
    status,
    headers: { get: () => null },
    json: () => Promise.resolve({}),
  }
}

function makeMessage(overrides: {
  id: string
  authorId?: string
  bot?: boolean
  timestamp?: string
  content?: string
  channelId?: string
}) {
  return {
    id: overrides.id,
    channel_id: overrides.channelId ?? 'channel-1',
    author: {
      id: overrides.authorId ?? 'u1',
      username: 'user',
      discriminator: '0001',
      ...(overrides.bot ? { bot: true } : {}),
    },
    content: overrides.content ?? 'hello',
    timestamp: overrides.timestamp ?? '2026-05-05T10:00:00Z',
  }
}

const WEEK_START = new Date('2026-05-04T00:00:00Z')
const WEEK_END = new Date('2026-05-10T23:59:59Z')

describe('timestampToSnowflake', () => {
  it('converts the discord epoch itself to zero', () => {
    expect(timestampToSnowflake(1420070400000)).toBe('0')
  })

  it('converts a known timestamp to the correct snowflake', () => {
    expect(timestampToSnowflake(1420070400001)).toBe('4194304')
  })
})

describe('requestMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('rate limiting (429)', () => {
    it('retries after the wait time specified in the response body', async () => {
      vi.useFakeTimers()

      const rateLimitResponse = {
        ok: false,
        status: 429,
        headers: {
          get: (h: string) => {
            if (h === 'X-RateLimit-Remaining') return '0'
            if (h === 'X-RateLimit-Reset-After') return '1'
            return null
          },
        },
        json: () => Promise.resolve({ retry_after: 2 }),
      }

      mockFetch
        .mockResolvedValueOnce(rateLimitResponse)
        .mockResolvedValueOnce(mockMessagesResponse([makeMessage({ id: '1' })]))

      const fetchPromise = requestMessages('/channels/channel-1/messages?after=0&limit=100')
      await vi.runAllTimersAsync()
      await fetchPromise

      expect(mockFetch).toHaveBeenCalledTimes(2)

      vi.useRealTimers()
    })
  })

  describe('HTTP error codes', () => {
    it.each([
      [401, '401 Unauthorized: Invalid token provided'],
      [403, '403 Forbidden: No access to project channel'],
      [404, '404 Not Found: Project channel not found'],
    ])('throws a descriptive error for %i', async (status, expectedMessage) => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse(status))

      await expect(
        requestMessages('/channels/channel-1/messages?after=0&limit=100')
      ).rejects.toThrow(expectedMessage)
    })
  })
})

describe('runDiscordIngestion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(db.syncJob.create).mockResolvedValue({ id: 'sync-1' } as never)
    vi.mocked(db.syncJob.update).mockResolvedValue({} as never)
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([])
  })

  describe('WeeklyStats.discordMessages', () => {
    it('upserts WeeklyStats.discordMessages with the fetched message count', async () => {
      const projectId = 'project-1'
      const channelId = 'channel-1'

      vi.mocked(db.project.findMany).mockResolvedValue([
        {
          id: projectId,
          name: 'Test Project',
          channels: [{ externalId: channelId, name: 'general' }],
        },
      ] as never)

      mockFetch
        .mockResolvedValueOnce(
          mockMessagesResponse([
            makeMessage({
              id: '1',
              authorId: 'u1',
              content: 'hello',
              timestamp: '2026-05-05T10:00:00Z',
            }),
            makeMessage({
              id: '2',
              authorId: 'u2',
              content: 'world',
              timestamp: '2026-05-06T10:00:00Z',
            }),
            makeMessage({
              id: '3',
              authorId: 'u1',
              content: 'again',
              timestamp: '2026-05-07T10:00:00Z',
            }),
          ])
        )
        .mockResolvedValueOnce(mockMessagesResponse([]))

      await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(db.weeklyStats.upsert).toHaveBeenCalledWith({
        where: { projectId_weekStart: { projectId, weekStart: WEEK_START } },
        create: { projectId, weekStart: WEEK_START, discordMessages: 3 },
        update: { discordMessages: 3 },
      })
    })

    it('includes weeklyStats.upsert inside the same transaction as the discord aggregate', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-2', name: 'Other', channels: [{ externalId: 'c2', name: 'general' }] },
      ] as never)
      vi.mocked(db.syncJob.create).mockResolvedValue({ id: 'sync-2' } as never)

      mockFetch
        .mockResolvedValueOnce(mockMessagesResponse([makeMessage({ id: '10', channelId: 'c2' })]))
        .mockResolvedValueOnce(mockMessagesResponse([]))

      await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(db.$transaction).toHaveBeenCalledTimes(1)
      const txCallArg = vi.mocked(db.$transaction).mock.calls[0][0]
      expect(Array.isArray(txCallArg)).toBe(true)
      expect(db.discordWeeklyAggregate.upsert).toHaveBeenCalled()
      expect(db.weeklyStats.upsert).toHaveBeenCalled()
    })
  })

  describe('message filtering', () => {
    it('filters out messages outside the weekly window', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-1', name: 'Test', channels: [{ externalId: 'channel-1', name: 'general' }] },
      ] as never)

      mockFetch
        .mockResolvedValueOnce(
          mockMessagesResponse([
            makeMessage({ id: '1', timestamp: '2026-05-05T10:00:00Z', content: 'inside' }),
            makeMessage({ id: '2', timestamp: '2026-05-03T23:59:59Z', content: 'before window' }),
            makeMessage({ id: '3', timestamp: '2026-05-11T00:00:01Z', content: 'after window' }),
          ])
        )
        .mockResolvedValueOnce(mockMessagesResponse([]))

      const result = await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(result[0].messages).toEqual(['inside'])
    })

    it('excludes bot messages', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-1', name: 'Test', channels: [{ externalId: 'channel-1', name: 'general' }] },
      ] as never)

      mockFetch
        .mockResolvedValueOnce(
          mockMessagesResponse([
            makeMessage({ id: '1', content: 'human message' }),
            makeMessage({ id: '2', bot: true, content: 'bot message' }),
          ])
        )
        .mockResolvedValueOnce(mockMessagesResponse([]))

      const result = await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(result[0].messages).toEqual(['human message'])
    })
  })

  describe('pagination', () => {
    it('collects messages across multiple pages', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-1', name: 'Test', channels: [{ externalId: 'channel-1', name: 'general' }] },
      ] as never)

      const page1 = Array.from({ length: 100 }, (_, i) =>
        makeMessage({ id: String(i + 1), content: `msg ${i + 1}` })
      )
      const page2 = [
        makeMessage({ id: '101', content: 'msg 101' }),
        makeMessage({ id: '102', content: 'msg 102' }),
      ]

      mockFetch
        .mockResolvedValueOnce(mockMessagesResponse(page1))
        .mockResolvedValueOnce(mockMessagesResponse(page2))
        .mockResolvedValueOnce(mockMessagesResponse([]))

      const result = await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(result[0].messages).toHaveLength(102)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('after=100'),
        expect.any(Object)
      )
    })
  })

  describe('projects with no channels', () => {
    it('skips the project without creating a sync job', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-1', name: 'No Channels Project', channels: [] },
      ] as never)

      const result = await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(result).toEqual([])
      expect(db.syncJob.create).not.toHaveBeenCalled()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  describe('failed channel fetch', () => {
    it('marks the sync job as FAILED with the error message', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([
        { id: 'project-1', name: 'Test', channels: [{ externalId: 'channel-1', name: 'general' }] },
      ] as never)

      mockFetch.mockResolvedValue(mockErrorResponse(403))

      await runDiscordIngestion(WEEK_START, WEEK_END)

      expect(db.syncJob.update).toHaveBeenCalledWith({
        where: { id: 'sync-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: '403 Forbidden: No access to project channel',
          finishedAt: expect.any(Date),
        }),
      })
    })
  })
})
