'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface MemberAvatarProps {
  name: string
  imageUrl: string | null
  color: string
  // What to render when there is no photo: a person silhouette for desktop view or a solid dot for mobile view
  fallback?: 'silhouette' | 'dot'
  className?: string
}

export default function MemberAvatar({
  name,
  imageUrl,
  color,
  fallback = 'silhouette',
  className,
}: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false)

  if (imageUrl && !imgError) {
    return (
      <Image
        src={imageUrl}
        alt={name}
        width={96}
        height={96}
        className={cn('rounded-full object-cover', className)}
        onError={() => setImgError(true)}
      />
    )
  }

  if (fallback === 'dot') {
    return (
      <span
        aria-label={name}
        role="img"
        className={cn('block rounded-full', className)}
        style={{ backgroundColor: color }}
      />
    )
  }

  return (
    <svg viewBox="0 0 96 96" role="img" aria-label={name} className={className}>
      <circle cx="48" cy="30" r="22" fill={color} />
      <path d="M48 58c-23 0-36 15-38 38h76c-2-23-15-38-38-38z" fill={color} />
    </svg>
  )
}
