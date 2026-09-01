/**
 * Cross-source LLM analysis job.
 * Reads CommitFact messages from the database (written by runGitHubIngestion) and
 * receives Discord messages in-memory (never persisted, written by runDiscordIngestion).
 * For each active project, calls the LLM and upserts sentimentScore, sentimentParagraph,
 * and summaryText onto WeeklySummary — keyed on [projectId, weekStart]
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
import type { ProjectData } from './discord'

const MVP_FORMULA_KEY = 'mvpFormula'
const LOW_ACTIVITY_SUMMARY =
  'Not enough commit or Discord activity this week to generate a meaningful summary.'

// Below this combined count of commits + Discord messages, we consider the project to have "low activity" and
// will not attempt to compute a sentiment score.
export const LOW_ACTIVITY_THRESHOLD = 10
export const PROMPT_VERSION = 'weekly-project-summary-v1'

export function isLowActivity(commitMessageCount: number, discordMessageCount: number): boolean {
  return commitMessageCount + discordMessageCount < LOW_ACTIVITY_THRESHOLD
}

// Defends the fixed -1.0..1.0 contract even if the model returns something out of range.
export function clampSentimentScore(score: unknown): number | null {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null
  return Math.min(1, Math.max(-1, score))
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
}
