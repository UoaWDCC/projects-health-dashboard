import { describe, it, expect, vi } from 'vitest'
import { db } from '@repo/db'
import { runGlobalSummary, NO_DATA_GLOBAL_SUMMARY, GLOBAL_PROMPT_VERSION } from './llm'
import { INSUFFICIENT_DATA } from '../lib/global-summary-prompt'

vi.mock('../lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))

const weekStart = new Date('2026-09-14T00:00:00Z')
const weekEnd = new Date('2026-09-20T23:59:59Z')
const projects = [
  { id: 'p1', name: 'Alpha' },
  { id: 'p2', name: 'Beta' },
]

function makeAiClient(summaryText = 'Overall the portfolio is steady.') {
  return {
    request: vi.fn().mockResolvedValue({
      data: { summaryText },
      provenance: { model: 'test-model', promptVersion: GLOBAL_PROMPT_VERSION },
    }),
  }
}

describe('runGlobalSummary', () => {
  it('sends every project to the LLM and upserts one row keyed on weekStart', async () => {
    vi.mocked(db.weeklySummary.findMany).mockResolvedValue([
      { projectId: 'p1', summaryText: 'Shipped auth.', sentimentScore: 0.6 },
    ] as never)
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue(null)
    const aiClient = makeAiClient()

    await runGlobalSummary(weekStart, weekEnd, projects, aiClient)

    const { messages, temperature } = aiClient.request.mock.calls[0][0]
    expect(temperature).toBe(0)
    expect(messages[1].content).toContain('Shipped auth.')
    // Beta has no WeeklySummary row → noted as insufficient data, not skipped
    expect(messages[1].content).toMatch(new RegExp(`### Beta\n.*${INSUFFICIENT_DATA}`))

    const upsert = vi.mocked(db.globalWeeklySummary.upsert).mock.calls[0][0]
    expect(upsert.where).toEqual({ weekStart })
    expect(upsert.create).toMatchObject({
      weekStart,
      summaryText: 'Overall the portfolio is steady.',
      llmModel: 'test-model',
      llmPromptVersion: GLOBAL_PROMPT_VERSION,
    })
    expect(upsert.update).toMatchObject({ summaryText: 'Overall the portfolio is steady.' })
  })

  it('treats the low-activity placeholder summary as insufficient data', async () => {
    vi.mocked(db.weeklySummary.findMany).mockResolvedValue([
      { projectId: 'p1', summaryText: 'Shipped auth.', sentimentScore: 0.6 },
      {
        projectId: 'p2',
        summaryText:
          'Not enough commit or Discord activity this week to generate a meaningful summary.',
        sentimentScore: null,
      },
    ] as never)
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue(null)
    const aiClient = makeAiClient()

    await runGlobalSummary(weekStart, weekEnd, projects, aiClient)

    const user = aiClient.request.mock.calls[0][0].messages[1].content
    expect(user).not.toContain('Not enough commit or Discord activity')
    expect(user).toContain(`Weekly summary (actual work and contribution): ${INSUFFICIENT_DATA}`)
  })

  it('writes a fixed summary without calling the LLM when no project has data', async () => {
    vi.mocked(db.weeklySummary.findMany).mockResolvedValue([])
    const aiClient = makeAiClient()

    await runGlobalSummary(weekStart, weekEnd, projects, aiClient)

    expect(aiClient.request).not.toHaveBeenCalled()
    expect(vi.mocked(db.globalWeeklySummary.upsert).mock.calls[0][0].create).toMatchObject({
      summaryText: NO_DATA_GLOBAL_SUMMARY,
      llmInputHash: null,
    })
  })

  it('keeps the existing summary on a rerun with unchanged inputs', async () => {
    vi.mocked(db.weeklySummary.findMany).mockResolvedValue([
      { projectId: 'p1', summaryText: 'Shipped auth.', sentimentScore: 0.6 },
    ] as never)
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue(null)
    const first = makeAiClient()
    await runGlobalSummary(weekStart, weekEnd, projects, first)
    const { llmInputHash } = vi.mocked(db.globalWeeklySummary.upsert).mock.calls[0][0].create

    vi.mocked(db.globalWeeklySummary.upsert).mockClear()
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue({ llmInputHash } as never)
    const second = makeAiClient()
    await runGlobalSummary(weekStart, weekEnd, projects, second)

    expect(second.request).not.toHaveBeenCalled()
    expect(db.globalWeeklySummary.upsert).not.toHaveBeenCalled()
  })

  it('does not write when the LLM returns no summary text', async () => {
    vi.mocked(db.weeklySummary.findMany).mockResolvedValue([
      { projectId: 'p1', summaryText: 'Shipped auth.', sentimentScore: 0.6 },
    ] as never)
    vi.mocked(db.globalWeeklySummary.findUnique).mockResolvedValue(null)

    await runGlobalSummary(weekStart, weekEnd, projects, makeAiClient('  '))

    expect(db.globalWeeklySummary.upsert).not.toHaveBeenCalled()
  })
})
