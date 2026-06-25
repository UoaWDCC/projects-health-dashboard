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
      className="flex min-h-16 w-full items-center gap-3 rounded-2xl px-3 py-3 transition-opacity duration-150 hover:opacity-80 lg:min-h-20 lg:gap-4 lg:rounded-3xl lg:px-5"
      style={{
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

      <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#CFE8FC] lg:size-12">
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
