import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./jobs/github', () => ({
  runGitHubIngestion: vi.fn(),
}))
vi.mock('./jobs/discord', () => ({
  runDiscordIngestion: vi.fn(),
}))
vi.mock('./lib/health-score', () => ({
  computeHealthScoresForActiveProjects: vi.fn(() => Promise.resolve()),
}))
vi.mock('./lib/velocity', () => ({
  computeVelocityForActiveProjects: vi.fn(() => Promise.resolve()),
}))
vi.mock('./lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('./lib/date-utils', () => ({
  getCollectionWindow: vi.fn(() => [
    new Date('2026-05-04T00:00:00Z'),
    new Date('2026-05-10T23:59:59Z'),
  ]),
}))

import { main } from './index'
import { runGitHubIngestion } from './jobs/github'
import { runDiscordIngestion } from './jobs/discord'
import { computeVelocityForActiveProjects } from './lib/velocity'
import { logger } from './lib/logger'

const SUCCESS_LOG = 'Weekly ingestion complete'

describe('main', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runDiscordIngestion).mockResolvedValue([])
  })

  it('logs the success completion message when both jobs succeed', async () => {
    vi.mocked(runGitHubIngestion).mockResolvedValue(undefined)

    await main()

    expect(logger.info).toHaveBeenCalledWith(SUCCESS_LOG)
  })

  it('completion log reflects the failure when GitHub ingestion rejects', async () => {
    vi.mocked(runGitHubIngestion).mockRejectedValue(new Error('boom'))

    await main()

    // The success completion log must not fire on a failed GitHub run...
    expect(logger.info).not.toHaveBeenCalledWith(SUCCESS_LOG)
    // ...and the completion log must clearly surface the failure.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Weekly ingestion completed with errors')
    )
  })

  it('completion log reflects the failure when only Discord fails (both jobs must succeed)', async () => {
    vi.mocked(runGitHubIngestion).mockResolvedValue(undefined)
    vi.mocked(runDiscordIngestion).mockRejectedValue(new Error('discord down'))

    await main()

    // The success completion log must not fire when Discord fails...
    expect(logger.info).not.toHaveBeenCalledWith(SUCCESS_LOG)
    // ...and the completion log must clearly surface the failure.
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Weekly ingestion completed with errors')
    )
  })

  it('computes velocity for the previous and current week once ingestion succeeds', async () => {
    vi.mocked(runGitHubIngestion).mockResolvedValue(undefined)

    await main()

    // getCollectionWindow is mocked to always return the same fixed week regardless
    // of its argument, so both prevWeekStart and weekStart resolve to that week here.
    expect(computeVelocityForActiveProjects).toHaveBeenCalledWith([
      new Date('2026-05-04T00:00:00Z'),
      new Date('2026-05-04T00:00:00Z'),
    ])
  })

  it('skips velocity computation when GitHub ingestion fails', async () => {
    vi.mocked(runGitHubIngestion).mockRejectedValue(new Error('boom'))

    await main()

    expect(computeVelocityForActiveProjects).not.toHaveBeenCalled()
  })
})
