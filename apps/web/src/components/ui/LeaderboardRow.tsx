import { cn } from '@/lib/utils'
import { formatStat, LeaderboardEntry, LeaderboardRowTheme } from '@/lib/project/leaderboard'
import Image from 'next/image'
import Link from 'next/link'

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  theme: LeaderboardRowTheme
}

export default function LeaderboardRow({ entry, theme }: LeaderboardRowProps) {
  const { rank, projectSlug, projectName, thumbnailUrl, statValue } = entry
  const { fillColor, borderColor, lightFillColor, lightBorderColor } = theme
  const isFirstPlace = rank === 1

  const bgBase = isFirstPlace ? fillColor : lightFillColor
  const border = isFirstPlace
    ? `2px solid ${borderColor ?? fillColor}`
    : `2px solid ${lightBorderColor}`
  const textClass = isFirstPlace ? 'text-white' : 'text-black'

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
          isFirstPlace ? 'font-bold' : 'font-medium',
          textClass
        )}
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

      <span className={cn('font-sans text-2xl flex-1 truncate font-bold', textClass)}>
        {projectName}
      </span>

      <span className={cn('font-mono text-xl font-medium shrink-0', textClass)}>
        {formatStat(statValue)}
      </span>
    </Link>
  )
}
