import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@repo/db'
import { mockFetch } from '../test-config/vitest.setup'

vi.mock('../lib/github-weekly-stats', () => ({
  computeWeeklyGitHubMetrics: vi.fn(),
}))
vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { fetchHistoricalMessages, bucketByWeek, writeDiscordWeek, main } from './backfill-discord'

type APIMessage = {
  id: string
  channel_id: string
  author: { id: string; username: string; discriminator: string; bot?: boolean }
  content: string
  timestamp: string
}

function makeMsg(id: string, authorId: string, timestamp: string, bot = false): APIMessage {
  return {
    id,
    channel_id: 'channel-1',
    author: {
      id: authorId,
      username: 'user',
      discriminator: '0001',
      ...(bot ? { bot: true } : {}),
    },
    content: 'hello',
    timestamp,
  }
}

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

describe('fetchHistoricalMessages', () => {
  it('returns empty array when the first batch is empty', async () => {
    mockFetch.mockResolvedValueOnce(mockMessagesResponse([]))

    const result = await fetchHistoricalMessages('ch-1', '9999', 0)

    expect(result).toEqual([])
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('filters out bot messages and messages before fromMs', async () => {
    const fromMs = new Date('2026-05-04T00:00:00Z').getTime()
    mockFetch
      .mockResolvedValueOnce(
        mockMessagesResponse([
          makeMsg('1', 'u1', '2026-05-06T10:00:00Z'),
          makeMsg('2', 'u2', '2026-05-06T10:00:00Z', true), // bot — excluded
          makeMsg('3', 'u3', '2026-05-01T10:00:00Z'), // before fromMs — excluded
        ])
      )
      .mockResolvedValueOnce(mockMessagesResponse([]))

    const result = await fetchHistoricalMessages('ch-1', '9999', fromMs)

    expect(result).toHaveLength(1)
    expect(result[0].authorId).toBe('u1')
  })

  it('paginates backwards using the last message id as the next cursor', async () => {
    const fromMs = new Date('2026-04-01T00:00:00Z').getTime()
    const page1 = Array.from({ length: 100 }, (_, i) =>
      makeMsg(String(100 - i), 'u1', '2026-05-01T10:00:00Z')
    )

    mockFetch
      .mockResolvedValueOnce(mockMessagesResponse(page1))
      .mockResolvedValueOnce(mockMessagesResponse([]))

    const result = await fetchHistoricalMessages('ch-1', '9999', fromMs)

    expect(result).toHaveLength(100)
    // The last message in page1 has id '1'; next fetch should use before=1
    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('before=1'),
      expect.any(Object)
    )
  })

  it('stops paginating when the oldest message in a full batch is before fromMs', async () => {
    const fromMs = new Date('2026-05-04T00:00:00Z').getTime()
    // 100-message batch where only the last (oldest) entry is before fromMs
    const batch = Array.from({ length: 100 }, (_, i) =>
      makeMsg(String(100 - i), 'u1', i < 99 ? '2026-05-06T10:00:00Z' : '2026-04-01T00:00:00Z')
    )

    mockFetch.mockResolvedValueOnce(mockMessagesResponse(batch))

    const result = await fetchHistoricalMessages('ch-1', '9999', fromMs)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(99) // oldest message excluded by the fromMs filter
  })

  it('stops after a partial page even when all messages are within range', async () => {
    const fromMs = new Date('2026-04-01T00:00:00Z').getTime()
    const partialPage = Array.from({ length: 42 }, (_, i) =>
      makeMsg(String(42 - i), 'u1', '2026-05-06T10:00:00Z')
    )

    mockFetch.mockResolvedValueOnce(mockMessagesResponse(partialPage))

    const result = await fetchHistoricalMessages('ch-1', '9999', fromMs)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(result).toHaveLength(42)
  })
})

describe('bucketByWeek', () => {
  it('returns an empty map for no messages', () => {
    expect(bucketByWeek([])).toEqual(new Map())
  })

  it('groups messages from the same week into one bucket with correct author counts', () => {
    const messages = [
      { authorId: 'u1', timestamp: new Date('2026-05-06T10:00:00Z') }, // Wed May 6 → week of May 4
      { authorId: 'u2', timestamp: new Date('2026-05-07T10:00:00Z') }, // Thu May 7 → same week
    ]

    const buckets = bucketByWeek(messages)

    expect(buckets.size).toBe(1)
    const [bucket] = buckets.values()
    expect(bucket.weekStart).toEqual(new Date('2026-05-04T00:00:00Z'))
    expect(bucket.authorCounts.get('u1')).toBe(1)
    expect(bucket.authorCounts.get('u2')).toBe(1)
  })

  it('accumulates multiple messages from the same author in the same week', () => {
    const messages = [
      { authorId: 'u1', timestamp: new Date('2026-05-05T08:00:00Z') },
      { authorId: 'u1', timestamp: new Date('2026-05-06T09:00:00Z') },
      { authorId: 'u1', timestamp: new Date('2026-05-07T10:00:00Z') },
    ]

    const buckets = bucketByWeek(messages)

    const [bucket] = buckets.values()
    expect(bucket.authorCounts.get('u1')).toBe(3)
  })

  it('creates separate buckets for messages in different weeks', () => {
    const messages = [
      { authorId: 'u1', timestamp: new Date('2026-05-06T10:00:00Z') }, // week of May 4
      { authorId: 'u1', timestamp: new Date('2026-05-13T10:00:00Z') }, // week of May 11
    ]

    const buckets = bucketByWeek(messages)

    expect(buckets.size).toBe(2)
    const weekStarts = [...buckets.values()].map((b) => b.weekStart.toISOString())
    expect(weekStarts).toContain('2026-05-04T00:00:00.000Z')
    expect(weekStarts).toContain('2026-05-11T00:00:00.000Z')
  })
})

describe('writeDiscordWeek', () => {
  const projectId = 'proj-1'
  const weekStart = new Date('2026-05-04T00:00:00Z')

  beforeEach(() => {
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([])
  })

  it('upserts DiscordWeeklyAggregate with correct message count, unique authors, and unmapped count', async () => {
    const authorCounts = new Map([
      ['discord-u1', 3],
      ['discord-u2', 2],
    ])

    await writeDiscordWeek(projectId, weekStart, authorCounts)

    expect(db.discordWeeklyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_weekStart: { projectId, weekStart } },
        create: expect.objectContaining({
          projectId,
          weekStart,
          messageCount: 5,
          uniqueAuthors: 2,
          unmappedMessageCount: 5, // all authors unmapped since personIdentity.findMany returns []
        }),
      })
    )
  })

  it('upserts DiscordIdentityWeeklyCount only for authors with a known identity', async () => {
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([
      { id: 'ident-1', externalId: 'discord-u1' },
    ] as never)

    const authorCounts = new Map([
      ['discord-u1', 3],
      ['discord-u2', 2], // unmapped
    ])

    await writeDiscordWeek(projectId, weekStart, authorCounts)

    expect(db.discordIdentityWeeklyCount.upsert).toHaveBeenCalledTimes(1)
    expect(db.discordIdentityWeeklyCount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId_weekStart_authorIdentityId: {
            projectId,
            weekStart,
            authorIdentityId: 'ident-1',
          },
        },
        create: expect.objectContaining({ messageCount: 3 }),
      })
    )
    expect(db.discordWeeklyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ unmappedMessageCount: 2 }),
      })
    )
  })

  it('does not call DiscordIdentityWeeklyCount.upsert when all authors are unmapped', async () => {
    const authorCounts = new Map([['unknown-user', 7]])

    await writeDiscordWeek(projectId, weekStart, authorCounts)

    expect(db.discordIdentityWeeklyCount.upsert).not.toHaveBeenCalled()
    expect(db.discordWeeklyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ unmappedMessageCount: 7, messageCount: 7 }),
      })
    )
  })

  it('returns the total message count across all authors', async () => {
    const authorCounts = new Map([
      ['u1', 4],
      ['u2', 6],
    ])

    const result = await writeDiscordWeek(projectId, weekStart, authorCounts)

    expect(result).toBe(10)
  })
})

describe('main', () => {
  beforeEach(() => {
    vi.mocked(db.syncJob.create).mockResolvedValue({ id: 'sync-1' } as never)
    vi.mocked(db.syncJob.update).mockResolvedValue({} as never)
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([])
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([])
    // Empty channel → fetchHistoricalMessages terminates after one call
    mockFetch.mockResolvedValue(mockMessagesResponse([]))
  })

  it('creates a SyncJob for each active project that has channels', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'Alpha',
        channels: [{ externalId: 'c1', name: 'general' }],
        repositories: [],
      },
      { id: 'p2', name: 'Beta', channels: [{ externalId: 'c2', name: 'dev' }], repositories: [] },
    ] as never)
    vi.mocked(db.syncJob.create)
      .mockResolvedValueOnce({ id: 'job-1' } as never)
      .mockResolvedValueOnce({ id: 'job-2' } as never)

    await main()

    expect(db.syncJob.create).toHaveBeenCalledTimes(2)
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1', type: 'DISCORD', status: 'RUNNING' }),
    })
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p2', type: 'DISCORD', status: 'RUNNING' }),
    })
  })

  it('skips projects with no channels and does not create a SyncJob for them', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'With Channels',
        channels: [{ externalId: 'c1', name: 'general' }],
        repositories: [],
      },
      { id: 'p2', name: 'No Channels', channels: [], repositories: [] },
    ] as never)

    await main()

    expect(db.syncJob.create).toHaveBeenCalledTimes(1)
    expect(db.syncJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'p1' }),
    })
  })

  it('marks the SyncJob as SUCCESS after a successful run', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'Alpha',
        channels: [{ externalId: 'c1', name: 'general' }],
        repositories: [],
      },
    ] as never)

    await main()

    expect(db.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: expect.objectContaining({ status: 'SUCCESS', finishedAt: expect.any(Date) }),
    })
  })

  it('marks the SyncJob as FAILED when a channel fetch throws', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'Alpha',
        channels: [{ externalId: 'c1', name: 'general' }],
        repositories: [],
      },
    ] as never)
    mockFetch.mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
      json: () => Promise.resolve({}),
    })

    await main()

    expect(db.syncJob.update).toHaveBeenCalledWith({
      where: { id: 'sync-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: '403 Forbidden: No access to project channel',
        finishedAt: expect.any(Date),
      }),
    })
  })

  it('creates no SyncJobs when there are no active projects', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([])

    await main()

    expect(db.syncJob.create).not.toHaveBeenCalled()
  })

  it('zeroes out discordMessages on WeeklyStats rows for weeks with no Discord activity', async () => {
    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'p1',
        name: 'Alpha',
        channels: [{ externalId: 'c1', name: 'general' }],
        repositories: [],
      },
    ] as never)
    // Simulate two historical weeks that had GitHub commits but no Discord messages
    const githubOnlyWeek1 = new Date('2026-04-28T00:00:00Z')
    const githubOnlyWeek2 = new Date('2026-05-05T00:00:00Z')
    vi.mocked(db.weeklyStats.findMany).mockResolvedValue([
      { weekStart: githubOnlyWeek1 },
      { weekStart: githubOnlyWeek2 },
    ] as never)

    await main()

    expect(db.weeklyStats.update).toHaveBeenCalledTimes(2)
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { projectId_weekStart: { projectId: 'p1', weekStart: githubOnlyWeek1 } },
      data: { discordMessages: 0 },
    })
    expect(db.weeklyStats.update).toHaveBeenCalledWith({
      where: { projectId_weekStart: { projectId: 'p1', weekStart: githubOnlyWeek2 } },
      data: { discordMessages: 0 },
    })
  })
})
