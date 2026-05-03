export const formatStat = (value: number | string): string => {
  if (typeof value === 'string') return value
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`
  return value.toString()
}

// Colour theme applied to a leaderboard section. fillColor is the rank-1 highlight
// background; borderColor is the accent border shown only on the first-place row.
export interface LeaderboardRowTheme {
  fillColor: string
  borderColor?: string
}

// One theme per leaderboard category, matched to the Figma spec.
export const LEADERBOARD_THEMES = {
  pink: { fillColor: '#E9CFFC', borderColor: '#E333A3' },
  blue: { fillColor: '#CFE0FD', borderColor: '#077CF1' },
  orange: { fillColor: '#FDE6CF', borderColor: '#FFAC33' },
} satisfies Record<string, LeaderboardRowTheme>

// Shape returned by every leaderboard query — maps directly onto LeaderboardRowData.
export interface LeaderboardEntry {
  rank: number
  projectId: string
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
