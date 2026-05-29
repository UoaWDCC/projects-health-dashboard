import { describe, it, expect, vi } from 'vitest'
import { db } from '@repo/db'
import { mockFetch } from '../test-config/vitest.setup'
import { runDiscordIngestion } from './discord'

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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('runDiscordIngestion - WeeklyStats.discordMessages', () => {
  it('upserts WeeklyStats.discordMessages with the fetched message count', async () => {
    const weekStart = new Date('2026-05-04T00:00:00Z')
    const weekEnd = new Date('2026-05-10T23:59:59Z')
    const projectId = 'project-1'
    const channelId = 'channel-1'

    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: projectId,
        name: 'Test Project',
        channels: [{ externalId: channelId, name: 'general' }],
      },
    ] as never)

    vi.mocked(db.syncJob.create).mockResolvedValue({ id: 'sync-1' } as never)
    vi.mocked(db.syncJob.update).mockResolvedValue({} as never)
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([])

    const messages = [
      {
        id: '1',
        channel_id: channelId,
        author: { id: 'u1', username: 'a', discriminator: '0001' },
        content: 'hello',
        timestamp: '2026-05-05T10:00:00Z',
      },
      {
        id: '2',
        channel_id: channelId,
        author: { id: 'u2', username: 'b', discriminator: '0002' },
        content: 'world',
        timestamp: '2026-05-06T10:00:00Z',
      },
      {
        id: '3',
        channel_id: channelId,
        author: { id: 'u1', username: 'a', discriminator: '0001' },
        content: 'again',
        timestamp: '2026-05-07T10:00:00Z',
      },
    ]

    mockFetch
      .mockResolvedValueOnce(mockMessagesResponse(messages))
      .mockResolvedValueOnce(mockMessagesResponse([]))

    await runDiscordIngestion(weekStart, weekEnd)

    expect(db.weeklyStats.upsert).toHaveBeenCalledWith({
      where: { projectId_weekStart: { projectId, weekStart } },
      create: { projectId, weekStart, discordMessages: 3 },
      update: { discordMessages: 3 },
    })
  })

  it('includes weeklyStats.upsert inside the same transaction as the discord aggregate', async () => {
    const weekStart = new Date('2026-05-04T00:00:00Z')
    const weekEnd = new Date('2026-05-10T23:59:59Z')

    vi.mocked(db.project.findMany).mockResolvedValue([
      {
        id: 'project-2',
        name: 'Other',
        channels: [{ externalId: 'c2', name: 'general' }],
      },
    ] as never)
    vi.mocked(db.syncJob.create).mockResolvedValue({ id: 'sync-2' } as never)
    vi.mocked(db.syncJob.update).mockResolvedValue({} as never)
    vi.mocked(db.personIdentity.findMany).mockResolvedValue([])

    mockFetch
      .mockResolvedValueOnce(
        mockMessagesResponse([
          {
            id: '10',
            channel_id: 'c2',
            author: { id: 'x', username: 'x', discriminator: '0001' },
            content: 'hi',
            timestamp: '2026-05-05T10:00:00Z',
          },
        ])
      )
      .mockResolvedValueOnce(mockMessagesResponse([]))

    await runDiscordIngestion(weekStart, weekEnd)

    expect(db.$transaction).toHaveBeenCalledTimes(1)
    const txCallArg = vi.mocked(db.$transaction).mock.calls[0][0]
    expect(Array.isArray(txCallArg)).toBe(true)
    // Aggregate + weeklyStats upserts are both included
    expect(db.discordWeeklyAggregate.upsert).toHaveBeenCalled()
    expect(db.weeklyStats.upsert).toHaveBeenCalled()
  })
})
