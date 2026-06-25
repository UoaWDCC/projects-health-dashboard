import resolveConfig from 'tailwindcss/resolveConfig'
import tailwindConfig from '../../../tailwind.config'

const fullConfig = resolveConfig(tailwindConfig)
type LeaderboardColumn = { fill: string; stroke: string; lightFill: string; lightStroke: string }
const lb = (
  fullConfig.theme.colors as unknown as {
    leaderboard: { loc: LeaderboardColumn; commits: LeaderboardColumn; prs: LeaderboardColumn }
  }
).leaderboard

export const formatStat = (value: number | string): string => {
  if (typeof value === 'string') return value
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toString()
}

// Colour theme applied to a leaderboard section. fillColor/borderColor are the rank-1
// highlight; lightFillColor/lightBorderColor are used for ranks 2–5.
export interface LeaderboardRowTheme {
  fillColor: string
  borderColor?: string
  lightFillColor: string
  lightBorderColor: string
}

export const LEADERBOARD_THEMES = {
  pink: {
    fillColor: lb.loc.fill,
    borderColor: lb.loc.stroke,
    lightFillColor: lb.loc.lightFill,
    lightBorderColor: lb.loc.lightStroke,
  },
  blue: {
    fillColor: lb.commits.fill,
    borderColor: lb.commits.stroke,
    lightFillColor: lb.commits.lightFill,
    lightBorderColor: lb.commits.lightStroke,
  },
  orange: {
    fillColor: lb.prs.fill,
    borderColor: lb.prs.stroke,
    lightFillColor: lb.prs.lightFill,
    lightBorderColor: lb.prs.lightStroke,
  },
} satisfies Record<string, LeaderboardRowTheme>

// Shape returned by every leaderboard query — maps directly onto LeaderboardRowData.
export interface LeaderboardEntry {
  rank: number
  projectId: string
  projectSlug: string
  projectName: string
  thumbnailUrl: string | undefined
  statValue: number
}

// A single row ready to be passed directly to <LeaderboardRow entry={} theme={} />.
export interface LeaderboardRowProps {
  entry: LeaderboardEntry
  theme: LeaderboardRowTheme
}

// Shape returned by getWeeklyLeaderboard — one array per leaderboard category.
export interface WeeklyLeaderboard {
  commits: LeaderboardRowProps[]
  merges: LeaderboardRowProps[]
  linesOfCode: LeaderboardRowProps[]
}

function attach(entries: LeaderboardEntry[], theme: LeaderboardRowTheme): LeaderboardRowProps[] {
  return entries.map((entry) => ({ entry, theme }))
}

// Fetches the weekly leaderboard from the API and attaches the correct theme
// to each category so rows can be passed directly to <LeaderboardRow />.
export async function fetchWeeklyLeaderboard(): Promise<WeeklyLeaderboard> {
  try {
    const response = await fetch('/api/weekly-leaderboard')
    if (!response.ok) throw new Error('Failed to fetch weekly leaderboard')
    const data = await response.json()

    return {
      linesOfCode: attach(data['lines-of-code'] ?? [], LEADERBOARD_THEMES.pink),
      commits: attach(data.commits ?? [], LEADERBOARD_THEMES.blue),
      merges: attach(data.merges ?? [], LEADERBOARD_THEMES.orange),
    }
  } catch (error) {
    console.error('Error fetching weekly leaderboard:', error)
    return { commits: [], merges: [], linesOfCode: [] }
  }
}
