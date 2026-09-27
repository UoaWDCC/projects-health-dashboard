// Builds the prompt for the weekly cross-project (global) summary LLM call.

import type { AiRequest } from './ai-client'

export interface GlobalSummaryResult {
  summaryText: string
}

export interface GlobalSummaryProjectInput {
  projectName: string
  // null when the project's weekly summary could not produce a score (e.g. low activity or LLM failure).
  sentimentScore: number | null
  // null when no usable weekly summary exists for the project this week.
  summaryText: string | null
}

export const INSUFFICIENT_DATA = 'Insufficient data this week.'

const SYSTEM_PROMPT = `You are an assistant that writes a single high-level weekly overview of ALL of an organisation's software projects for engineering leadership.

For each project you are given two inputs, which mean different things and must not be conflated:
- Sentiment score: a FIXED scale from -1.0 to 1.0 describing how the project's MEMBERS ARE FEELING (their mood and morale, taken from the tone of their messages). It says NOTHING about how much work was done or how productive the team was.
    -1.0 to -0.6 : frustrated, blocked, or burnt out
    -0.5 to -0.1 : mildly negative — stress, complaints, friction
     0.0 to  0.4 : neutral to mildly positive
     0.5 to  0.7 : positive — engaged, collaborative, upbeat
     0.8 to  1.0 : very positive — excited, energized, celebrating wins
- Weekly summary: a paragraph describing the ACTUAL WORK AND CONTRIBUTION on that project this week — what was built, fixed, or discussed, and who contributed. Use this, not the sentiment score, to judge progress and output.

A project marked "${INSUFFICIENT_DATA}" had too little activity (or no usable analysis) this week. Do not guess about it; if any such projects exist, briefly note by name that they had insufficient data rather than leaving them out.

Write ONE paragraph (roughly 4-7 sentences) of plain prose for a leadership audience that gives an overall read across all projects together:
- The general state of work and progress across the portfolio.
- The general mood/morale across teams, and any notable mismatch between mood and output.
- Any cross-cutting themes or concerns that genuinely appear in the inputs — never invent concerns.
Do NOT produce a per-project breakdown, bullet points, or headings; mention individual projects only where they illustrate a portfolio-wide point or have insufficient data.

Be consistent: given the same inputs, reach the same overall conclusions and tone. Stick to what the inputs support.

Respond with ONLY a single JSON object, matching exactly this shape:
{
  "summaryText": string   // the single global summary paragraph
}`

function formatProject(project: GlobalSummaryProjectInput): string {
  const sentiment =
    project.sentimentScore === null ? INSUFFICIENT_DATA : project.sentimentScore.toFixed(1)
  const summary = project.summaryText ?? INSUFFICIENT_DATA
  return `### ${project.projectName}
Sentiment score (member mood, not contribution): ${sentiment}
Weekly summary (actual work and contribution): ${summary}`
}

export function buildGlobalSummaryMessages(input: {
  weekStart: Date
  weekEnd: Date
  projects: GlobalSummaryProjectInput[]
}): AiRequest['messages'] {
  const { weekStart, weekEnd } = input
  // Stable ordering so reruns over the same data produce an identical prompt.
  const projects = [...input.projects].sort((a, b) => a.projectName.localeCompare(b.projectName))

  const userContent = `Week: ${weekStart.toISOString().slice(0, 10)} to ${weekEnd.toISOString().slice(0, 10)}
Active projects (${projects.length}):

${projects.map(formatProject).join('\n\n')}`

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ]
}
