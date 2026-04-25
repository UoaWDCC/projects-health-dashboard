'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Image from 'next/image'

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] })

interface WeeklyMvpProps {
  name: string
  avatarUrl?: string // Made optional
  linesCommitted: number
}

export default function WeeklyMvp({ name, avatarUrl, linesCommitted }: WeeklyMvpProps) {
  const [imgError, setImgError] = useState(false)

  // Use a generated avatar with the user's initials if no avatarUrl is provided or if the image failed to load
  const imgSrc =
    avatarUrl && !imgError
      ? avatarUrl
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`

  return (
    <div
      className={cn(
        'w-[1284px] h-[288px] flex bg-[linear-gradient(90deg,#077CF133_24%,#E333A333_51%,#FFB05F33_83%,#FFD4A733_100%)] rounded-3xl'
      )}
    >
      {/* Wrap the images in a relative container so the crown can be positioned relative to the avatar */}
      <div className="relative w-[175px] h-[175px] my-auto mx-10">
        {/* Main Avatar Image */}
        <Image
          src={imgSrc}
          alt={name}
          width={175}
          height={175}
          className={cn('w-full h-full rounded-full object-cover')}
          onError={() => setImgError(true)}
        />

        {/* MVP Crown Overlay */}
        <Image
          src="/mvp-crown.svg"
          alt="MVP Crown"
          width={175}
          height={175}
          className="absolute -top-[85px] -left-[65px] w-full h-full drop-shadow-md z-10"
        />
      </div>
      <div className={cn('flex flex-col justify-center ml-2', plusJakartaSans.className)}>
        <h1 className={cn('font-extrabold text-4xl mb-3 mt-3')}>{name}</h1>
        <p className={cn('text-2xl mt-3 font-medium text-[#5A5E7A]')}>
          Lines Committed:{' '}
          <span className={cn('font-bold text-[#1F2031]')}>{linesCommitted.toLocaleString()}</span>
        </p>
      </div>
    </div>
  )
}
