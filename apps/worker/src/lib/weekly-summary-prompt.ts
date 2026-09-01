// Builds the prompt for the weekly per-project sentiment + summary LLM call.

import type { AiRequest } from './ai-client'
import type { MemberMvpScore } from './mvp-scoring'

export interface ProjectSummaryResult {
  sentimentScore: number
  sentimentParagraph: string
  summaryText: string
}

export interface TopContributorInfo {
  displayName: string
  linesAdded: number
  commits: number
}

const SYSTEM_PROMPT = `You are an assistant that reports on a software team's weekly activity and mood for engineering leadership.

Score sentiment on a FIXED scale from -1.0 to 1.0 (one decimal place). Base the score ONLY on the tone/mood expressed in the commit messages and chat messages provided — frustration, burnout, excitement, confidence, and so on. Never base it on how much work was done; volume is not sentiment. Always use this exact scale, never invent your own:
  -1.0 to -0.6 : frustrated, blocked, or burnt out
  -0.5 to -0.1 : mildly negative — stress, complaints, friction
   0.0 to  0.4 : neutral to mildly positive
   0.5 to  0.7 : positive — engaged, collaborative, upbeat
   0.8 to  1.0 : very positive — excited, energized, celebrating wins

Respond with ONLY a single JSON object, matching exactly this shape:
{
  "sentimentScore": number,       // per the fixed scale above
  "sentimentParagraph": string,   // 1-2 sentences explaining why you gave that score
  "summaryText": string           // the full written weekly summary, see structure below
}

summaryText must read as prose for a leadership audience, covering, in order:
1. A brief overview of the week's activity.
2. Up to 3 specific areas of concern, if and only if the provided messages actually contain evidence of concern — never invent concerns to fill the quota, and omit this part entirely if there is nothing notable.
3. A mention of the top contributor. You are given who this is — state it as a fact, do not choose a different person. If you are told there is no clear top contributor this week, say so plainly in one short sentence rather than silently skipping the topic.
4. A callout of any members whose MVP score (also given to you) is significantly below the team or cross-project average — omit this part entirely if no one stands out as significantly behind.`

function formatMemberScores(scores: MemberMvpScore[]): string {
  if (scores.length === 0) return 'No member contribution data available for this week.'
  return scores
    .map((s) => `- ${s.displayName}: ${s.score === null ? 'unavailable' : s.score.toFixed(2)}`)
    .join('\n')
}

export function buildProjectSummaryMessages(input: {
  projectName: string
  weekStart: Date
  weekEnd: Date
  commitMessages: string[]
  discordMessages: string[]
  mvpFormula: string | null
  projectMemberScores: MemberMvpScore[]
  crossProjectAverageScore: number | null
  topContributor: TopContributorInfo | null
}): AiRequest['messages'] {
  const {
    projectName,
    weekStart,
    weekEnd,
    commitMessages,
    discordMessages,
    mvpFormula,
    projectMemberScores,
    crossProjectAverageScore,
    topContributor,
  } = input

  const projectAverageScore =
    projectMemberScores.filter((s) => s.score !== null).length > 0
      ? projectMemberScores.reduce((sum, s) => sum + (s.score ?? 0), 0) /
        projectMemberScores.filter((s) => s.score !== null).length
      : null

  const userContent = `Project: ${projectName}
Week: ${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}

Top contributor for this week (already determined from contribution data — mention this person, do not pick anyone else): ${
    topContributor
      ? `${topContributor.displayName} (${topContributor.commits} commits, ${topContributor.linesAdded} lines added)`
      : 'No clear top contributor this week.'
  }

MVP formula used to score members: ${mvpFormula ?? 'Not configured — no per-member scores available.'}
This project's member MVP scores this week:
${formatMemberScores(projectMemberScores)}
This project's average MVP score: ${projectAverageScore === null ? 'unavailable' : projectAverageScore.toFixed(2)}
Cross-project average MVP score this week (all active projects): ${crossProjectAverageScore === null ? 'unavailable' : crossProjectAverageScore.toFixed(2)}

Commit messages this week (${commitMessages.length}):
${commitMessages.length > 0 ? commitMessages.map((m) => `- ${m}`).join('\n') : '(none)'}

Discord messages this week (${discordMessages.length}):
${discordMessages.length > 0 ? discordMessages.map((m) => `- ${m}`).join('\n') : '(none)'}`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]
}
