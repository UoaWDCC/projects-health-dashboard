'use client'

import { useState } from 'react'
import Image from 'next/image'

interface MemberAvatarProps {
  name: string
  imageUrl?: string | null
  size?: number
  className?: string
}

/**
 * Circular member avatar. Falls back to the same local placeholder as the
 * Weekly MVP component when there is no image or it fails to load.
 */
export default function MemberAvatar({ name, imageUrl, size = 96, className }: MemberAvatarProps) {
  const [imgError, setImgError] = useState(false)

  const imgSrc = imageUrl && !imgError ? imageUrl : '/default-avatar.svg'

  return (
    <Image
      src={imgSrc}
      alt={name}
      width={size}
      height={size}
      className={`rounded-full object-cover ${className ?? ''}`}
      onError={() => setImgError(true)}
    />
  )
}
