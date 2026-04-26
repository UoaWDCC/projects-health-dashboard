'use client'

import { cn } from '@/lib/utils'
import { useState } from 'react'
import { Plus_Jakarta_Sans } from 'next/font/google'
import Image from 'next/image'

const plusJakartaSans = Plus_Jakarta_Sans({ subsets: ['latin'] })

interface WeeklyMvpProps {
  name: string
  avatarUrl?: string
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
    <div className="w-full max-w-[1284px] flex flex-col md:flex-row items-center bg-[linear-gradient(90deg,#077CF133_24%,#E333A333_51%,#FFB05F33_83%,#FFD4A733_100%)] rounded-3xl p-6 md:p-0 md:h-[288px]">
      {/* Wrap the images in a relative container so the crown can be positioned relative to the avatar */}
      <div className="relative w-32 h-32 mt-5 md:w-[175px] md:h-[175px] mx-auto md:mx-10 mb-6 md:my-auto shrink-0">
        {/* Main Avatar Image */}
        <Image
          src={imgSrc}
          alt={name}
          width={175}
          height={175}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImgError(true)}
        />

        {/* MVP Crown Overlay */}
        <Image
          src="/mvp-crown.svg"
          alt="MVP Crown"
          width={175}
          height={175}
          className="absolute -top-16 -left-12 md:-top-[85px] md:-left-[65px] w-full h-full drop-shadow-md z-10"
        />
      </div>
      <div
        className={cn(
          'flex flex-col justify-center text-center md:text-left md:ml-2',
          plusJakartaSans.className
        )}
      >
        <p className="font-extrabold text-2xl md:text-4xl mb-2 md:mb-3 md:mt-3">{name}</p>
        <p className="text-lg md:text-2xl mt-1 md:mt-3 font-medium text-[#5A5E7A]">
          Lines Committed:{' '}
          <span className="font-bold text-[#1F2031]">{linesCommitted.toLocaleString()}</span>
        </p>
      </div>
    </div>
  )
}
