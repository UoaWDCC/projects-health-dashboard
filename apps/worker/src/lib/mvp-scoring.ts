/**
 * Calculate scores for each member of every project for a given week through the MVP formula
 * for the LLM to determine whether a member is under the average.
 */

import { db } from '@repo/db'
import { buildFormulaScope, evaluateFormula } from './formula'

export interface MemberMvpScore {
  projectId: string
  personId: string
  displayName: string
  linesAdded: number
  commits: number
  score: number | null
}

export async function getMemberMvpScoresForWeek(
  weekStart: Date,
  formula: string
): Promise<MemberMvpScore[]> {
  const contributions = await db.memberWeeklyContribution.findMany({
    where: { weekStart, projectMember: { project: { isActive: true } } },
    select: {
      personId: true,
      commits: true,
      prsMerged: true,
      linesAdded: true,
      linesRemoved: true,
      discordMessages: true,
      projectMember: {
        select: {
          projectId: true,
          displayName: true,
          person: { select: { displayName: true } },
        },
      },
    },
  })

  return Promise.all(
    contributions.map(async (contribution) => ({
      projectId: contribution.projectMember.projectId,
      personId: contribution.personId,
      displayName:
        contribution.projectMember.displayName ?? contribution.projectMember.person.displayName,
      linesAdded: contribution.linesAdded,
      commits: contribution.commits,
      score: await evaluateFormula(formula, buildFormulaScope(contribution)),
    }))
  )
}
