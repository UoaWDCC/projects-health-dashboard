'use client'

import { cn } from '@/lib/utils'
import {
  formatStat,
  LeaderboardEntry,
  LeaderboardRowTheme,
} from '@/lib/exec-dashboard/leaderboard-row'
import Image from 'next/image'
import { useState } from 'react'

const NEUTRAL = { bg: '#D9D9D9', text: '#4E4E4D' }

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  theme: LeaderboardRowTheme
}

export default function LeaderboardRow({ entry, theme }: LeaderboardRowProps) {
  const { rank, projectName, thumbnailUrl, statValue } = entry
  const { fillColor, borderColor } = theme
  const [imgError, setImgError] = useState(false)
  const [hovered, setHovered] = useState(false)
  const isFirstPlace = rank === 1

  const bgBase = isFirstPlace ? fillColor : NEUTRAL.bg
  const bg = hovered ? `${bgBase}80` : bgBase
  const border = isFirstPlace && borderColor ? `2px solid ${borderColor}` : '2px solid transparent'
  const textColor = isFirstPlace ? '#1F2031' : NEUTRAL.text

  return (
    <div
      className="flex flex-row items-center gap-4 px-5 w-full"
      style={{
        maxWidth: '415px',
        height: '84px',
        borderRadius: '24.52px',
        backgroundColor: bg,
        border,
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Rank — mono 24px */}
      <span
        className={cn(
          'font-mono text-2xl min-w-[28px] text-center',
          isFirstPlace ? 'font-bold' : 'font-medium'
        )}
        style={{ color: textColor }}
      >
        {rank}
      </span>

      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 bg-[#CFE8FC] flex items-center justify-center">
        {thumbnailUrl && !imgError ? (
          <Image
            src={thumbnailUrl}
            alt={projectName}
            width={48}
            height={48}
            className="w-full h-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : null}
      </div>

      {/* Project name — sans 24px, bold when first */}
      <span
        className={cn(
          'font-sans text-2xl flex-1 truncate',
          isFirstPlace ? 'font-bold' : 'font-medium'
        )}
        style={{ color: textColor }}
      >
        {projectName}
      </span>

      {/* Stat value — mono 20px */}
      <span className="font-mono text-xl font-medium shrink-0" style={{ color: textColor }}>
        {formatStat(statValue)}
      </span>
    </div>
  )
}
