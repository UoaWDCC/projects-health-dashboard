'use client'

import { useState } from 'react'
import Image from 'next/image'

interface WeeklyMvpProps {
  name: string
  avatarUrl?: string
  linesCommitted: number
}

export default function WeeklyMvp({ name, avatarUrl, linesCommitted }: WeeklyMvpProps) {
  const [imgError, setImgError] = useState(false)

  // Fall back to a local default avatar — no third-party requests, no privacy concerns
  const imgSrc = avatarUrl && !imgError ? avatarUrl : '/default-avatar.svg'

  return (
    <div className="w-full flex flex-row items-center bg-[linear-gradient(90deg,#077CF133_24%,#E333A333_51%,#FFB05F33_83%,#FFD4A733_100%)] rounded-3xl p-4 lg:p-0 lg:h-[288px]">
      {/* Wrap the images in a relative container so the crown can be positioned relative to the avatar */}
      <div className="relative w-[72px] h-[72px] lg:w-[175px] lg:h-[175px] ml-2 mr-4 lg:mx-10 shrink-0">
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
          className="absolute -top-9 -left-7 lg:-top-[85px] lg:-left-[65px] w-full h-full drop-shadow-md z-10"
        />
      </div>
      <div className="flex flex-col font-sans justify-center text-left lg:ml-2 min-w-0">
        <p className="font-extrabold text-xl lg:text-4xl mb-1 lg:mb-3 lg:mt-3">{name}</p>
        <p className="text-sm lg:text-2xl lg:mt-3 font-medium text-wdcc-grey">
          Lines Committed:{' '}
          <span className="font-bold text-wdcc-oshan">{linesCommitted.toLocaleString()}</span>
        </p>
      </div>
    </div>
  )
}
