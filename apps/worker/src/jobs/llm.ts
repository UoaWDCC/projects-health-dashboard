/**
 * Cross-source LLM analysis job.
 * Reads CommitFact messages from the database (written by runGitHubIngestion) and
 * receives Discord messages in-memory (never persisted, written by runDiscordIngestion).
 * For each active project, calls the LLM and upserts sentimentScore, sentimentParagraph,
 * and summaryText onto WeeklySummary — keyed on [projectId, weekStart].
 * Then combines every active project's sentiment score + summary into a single cross-project
 * paragraph and upserts it onto GlobalWeeklySummary — keyed on weekStart.
 * Must run after runGitHubIngestion() and runDiscordIngestion() complete.
 */

import { createHash } from 'node:crypto'
import { db, pickMVP } from '@repo/db'
import { logger } from '../lib/logger'
import { createAiClient } from '../lib/ai-client'
import { getFormula } from '../lib/formula'
import { getMemberMvpScoresForWeek } from '../lib/mvp-scoring'
import {
  buildProjectSummaryMessages,
  type ProjectSummaryResult,
} from '../lib/weekly-summary-prompt'
import {
  buildGlobalSummaryMessages,
  type GlobalSummaryProjectInput,
  type GlobalSummaryResult,
} from '../lib/global-summary-prompt'
import type { ProjectData } from './discord'

const MVP_FORMULA_KEY = 'mvpFormula'
const LOW_ACTIVITY_SUMMARY =
  'Not enough commit or Discord activity this week to generate a meaningful summary.'

// Below this combined count of commits + Discord messages, we consider the project to have "low activity" and
// will not attempt to compute a sentiment score.
export const LOW_ACTIVITY_THRESHOLD = 10
export const PROMPT_VERSION = 'weekly-project-summary-v1'
export const GLOBAL_PROMPT_VERSION = 'weekly-global-summary-v1'
export const NO_DATA_GLOBAL_SUMMARY =
  'No active project had enough commit or Discord activity this week to generate a meaningful cross-project summary.'

export function isLowActivity(commitMessageCount: number, discordMessageCount: number): boolean {
  return commitMessageCount + discordMessageCount < LOW_ACTIVITY_THRESHOLD
}

// Defends the fixed -1.0..1.0 contract even if the model returns something out of range.
export function clampSentimentScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  const clamped = Math.min(1, Math.max(-1, score))
  return Math.round(clamped * 10) / 10
}

// Hash the LLM input to detect changes in the prompt or input data.
function hashInput(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

async function getCommitMessages(
  projectId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<string[]> {
  const commits = await db.commitFact.findMany({
    where: { repo: { projectId }, committedAt: { gte: weekStart, lte: weekEnd } },
    select: { message: true },
  })
  return commits.map((c) => c.message)
}

async function writeLowActivitySummary(projectId: string, weekStart: Date): Promise<void> {
  await db.weeklySummary.upsert({
    where: { projectId_weekStart: { projectId, weekStart } },
    create: {
      projectId,
      weekStart,
      summaryText: LOW_ACTIVITY_SUMMARY,
      sentimentScore: null,
      sentimentParagraph: null,
      llmModel: null,
      llmPromptVersion: null,
      llmInputHash: null,
    },
    update: {
      summaryText: LOW_ACTIVITY_SUMMARY,
      sentimentScore: null,
      sentimentParagraph: null,
      llmModel: null,
      llmPromptVersion: null,
      llmInputHash: null,
      generatedAt: new Date(),
    },
  })
}

export async function runLlmAnalysis(
  weekStart: Date,
  weekEnd: Date,
  discordMessages: ProjectData[]
): Promise<void> {
  const projects = await db.project.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
  })

  if (projects.length === 0) {
    logger.info('No active projects; skipping LLM analysis')
    return
  }

  const discordByProject = new Map(discordMessages.map((p) => [p.projectId, p.messages]))
  const mvpFormula = await getFormula(MVP_FORMULA_KEY)

  const allMemberScores = mvpFormula ? await getMemberMvpScoresForWeek(weekStart, mvpFormula) : []
  const validScores = allMemberScores
    .map((s) => s.score)
    .filter((score): score is number => score !== null)

  const crossProjectAverageScore =
    validScores.length > 0 ? validScores.reduce((sum, s) => sum + s, 0) / validScores.length : null
  const memberScoresByProject = new Map<string, typeof allMemberScores>()

  for (const memberScore of allMemberScores) {
    const group = memberScoresByProject.get(memberScore.projectId)
    if (group) group.push(memberScore)
    else memberScoresByProject.set(memberScore.projectId, [memberScore])
  }

  const aiClient = createAiClient()

  for (const project of projects) {
    const projectDiscordMessages = discordByProject.get(project.id) ?? []
    const commitMessages = await getCommitMessages(project.id, weekStart, weekEnd)

    if (isLowActivity(commitMessages.length, projectDiscordMessages.length)) {
      logger.info(`Project ${project.name}: low activity this week, skipping LLM call`)
      await writeLowActivitySummary(project.id, weekStart)
      continue
    }

    const projectMemberScores = memberScoresByProject.get(project.id) ?? []
    const messages = buildProjectSummaryMessages({
      projectName: project.name,
      weekStart,
      weekEnd,
      commitMessages,
      discordMessages: projectDiscordMessages,
      mvpFormula,
      projectMemberScores,
      crossProjectAverageScore,
      topContributor: pickMVP(projectMemberScores),
    })

    try {
      const { data, provenance } = await aiClient.request<ProjectSummaryResult>({
        messages,
        promptVersion: PROMPT_VERSION,
        temperature: 0,
      })

      const sentimentScore = clampSentimentScore(data.sentimentScore)

      await db.weeklySummary.upsert({
        where: { projectId_weekStart: { projectId: project.id, weekStart } },
        create: {
          projectId: project.id,
          weekStart,
          summaryText: data.summaryText,
          sentimentScore,
          sentimentParagraph: data.sentimentParagraph,
          llmModel: provenance.model,
          llmPromptVersion: provenance.promptVersion,
          llmInputHash: hashInput(messages),
        },
        update: {
          summaryText: data.summaryText,
          sentimentScore,
          sentimentParagraph: data.sentimentParagraph,
          llmModel: provenance.model,
          llmPromptVersion: provenance.promptVersion,
          llmInputHash: hashInput(messages),
          generatedAt: new Date(),
        },
      })

      logger.info(`Project ${project.name}: weekly summary generated (sentiment ${sentimentScore})`)
    } catch (err) {
      logger.error(`Project ${project.name}: LLM analysis failed: ${err}`)
    }
  }

  await runGlobalSummary(weekStart, weekEnd, projects, aiClient)
}

// Reads back this week's persisted per-project summaries (rather than the in-loop results) so
// projects whose LLM call failed — or that never got a row — are reported as insufficient data.
export async function getGlobalSummaryInputs(
  projects: Array<{ id: string; name: string }>,
  weekStart: Date
): Promise<GlobalSummaryProjectInput[]> {
  const summaries = await db.weeklySummary.findMany({
    where: { weekStart, projectId: { in: projects.map((p) => p.id) } },
    select: { projectId: true, summaryText: true, sentimentScore: true },
  })
  const byProject = new Map(summaries.map((s) => [s.projectId, s]))

  return projects.map((project) => {
    const summary = byProject.get(project.id)
    const summaryText =
      summary && summary.summaryText.trim() && summary.summaryText !== LOW_ACTIVITY_SUMMARY
        ? summary.summaryText
        : null
    return {
      projectName: project.name,
      sentimentScore: summary?.sentimentScore ?? null,
      summaryText,
    }
  })
}

async function upsertGlobalSummary(
  weekStart: Date,
  fields: {
    summaryText: string
    llmModel: string | null
    llmPromptVersion: string | null
    llmInputHash: string | null
  }
): Promise<void> {
  await db.globalWeeklySummary.upsert({
    where: { weekStart },
    create: { weekStart, notableChanges: '', ...fields },
    update: { ...fields, generatedAt: new Date() },
  })
}

export async function runGlobalSummary(
  weekStart: Date,
  weekEnd: Date,
  projects: Array<{ id: string; name: string }>,
  aiClient: ReturnType<typeof createAiClient>
): Promise<void> {
  const inputs = await getGlobalSummaryInputs(projects, weekStart)

  if (inputs.every((p) => p.summaryText === null && p.sentimentScore === null)) {
    logger.info('Global summary: no project has usable data this week, skipping LLM call')
    await upsertGlobalSummary(weekStart, {
      summaryText: NO_DATA_GLOBAL_SUMMARY,
      llmModel: null,
      llmPromptVersion: null,
      llmInputHash: null,
    })
    return
  }

  const messages = buildGlobalSummaryMessages({ weekStart, weekEnd, projects: inputs })
  const inputHash = hashInput(messages)

  // Rerunning a week with unchanged inputs keeps the existing paragraph instead of regenerating it,
  // so reruns stay consistent. A changed prompt or input data invalidates the hash.
  const existing = await db.globalWeeklySummary.findUnique({
    where: { weekStart },
    select: { llmInputHash: true },
  })
  if (existing?.llmInputHash === inputHash) {
    logger.info('Global summary: inputs unchanged since last run, keeping existing summary')
    return
  }

  try {
    const { data, provenance } = await aiClient.request<GlobalSummaryResult>({
      messages,
      promptVersion: GLOBAL_PROMPT_VERSION,
      temperature: 0,
    })

    if (typeof data.summaryText !== 'string' || !data.summaryText.trim()) {
      throw new Error('LLM response did not include a summaryText')
    }

    await upsertGlobalSummary(weekStart, {
      summaryText: data.summaryText.trim(),
      llmModel: provenance.model,
      llmPromptVersion: provenance.promptVersion,
      llmInputHash: inputHash,
    })

    logger.info(`Global summary generated across ${inputs.length} projects`)
  } catch (err) {
    logger.error(`Global summary generation failed: ${err}`)
  }
}
