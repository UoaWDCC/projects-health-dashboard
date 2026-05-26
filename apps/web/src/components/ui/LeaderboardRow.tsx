import { cn } from '@/lib/utils'
import { formatStat, LeaderboardEntry, LeaderboardRowTheme } from '@/lib/project/leaderboard'
import Image from 'next/image'
import Link from 'next/link'

const NEUTRAL = { bg: '#D9D9D9', text: '#4E4E4D' }

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  theme: LeaderboardRowTheme
}

export default function LeaderboardRow({ entry, theme }: LeaderboardRowProps) {
  const { rank, projectSlug, projectName, thumbnailUrl, statValue } = entry
  const { fillColor, borderColor } = theme
  const isFirstPlace = rank === 1

  const bgBase = isFirstPlace ? fillColor : NEUTRAL.bg
  const textColor = isFirstPlace ? '#1F2031' : NEUTRAL.text
  const border = isFirstPlace && borderColor ? `2px solid ${borderColor}` : '2px solid transparent'

  return (
    <Link
      href={projectSlug ? `/project/${projectSlug}` : '/'}
      className="flex flex-row items-center gap-4 px-5 w-full transition-[background-color] duration-150 ease hover:opacity-80"
      style={{
        maxWidth: '415px',
        height: '84px',
        borderRadius: '24.52px',
        backgroundColor: bgBase,
        border,
        cursor: 'pointer',
      }}
    >
      <span
        className={cn(
          'font-mono text-2xl min-w-[28px] text-center',
          isFirstPlace ? 'font-bold' : 'font-medium'
        )}
        style={{ color: textColor }}
      >
        {rank}
      </span>

      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#CFE8FC] flex items-center justify-center">
        {thumbnailUrl && (
          <Image
            src={thumbnailUrl}
            alt={projectName}
            width={48}
            height={48}
            className="w-full h-full object-cover"
          />
        )}
      </div>

      <span
        className={cn(
          'font-sans text-2xl flex-1 truncate',
          isFirstPlace ? 'font-bold' : 'font-medium'
        )}
        style={{ color: textColor }}
      >
        {projectName}
      </span>

      <span className="font-mono text-xl font-medium shrink-0" style={{ color: textColor }}>
        {formatStat(statValue)}
      </span>
    </Link>
  )
}
