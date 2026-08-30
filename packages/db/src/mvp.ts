export interface ScoredContributor {
  score: number | null
  linesAdded: number
  commits: number
  displayName: string
}

/**
 * Picks the top contributor from a set of already-scored candidates: highest
 * score wins, ties broken by linesAdded, then commits, then alphabetical
 * displayName.
 */
export function pickMVP(candidates: ScoredContributor[]): ScoredContributor | null {
  let top: ScoredContributor | null = null

  for (const candidate of candidates) {
    if (candidate.score === null) continue

    if (
      !top ||
      candidate.score > (top.score as number) ||
      (candidate.score === top.score &&
        (candidate.linesAdded > top.linesAdded ||
          (candidate.linesAdded === top.linesAdded && candidate.commits > top.commits) ||
          (candidate.linesAdded === top.linesAdded &&
            candidate.commits === top.commits &&
            candidate.displayName < top.displayName)))
    ) {
      top = candidate
    }
  }

  return top
}
