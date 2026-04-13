"use client"

import { cn } from '@/lib/utils'
import { useState } from 'react'

interface WeeklyMvpProps {
    name: string;
    avatarUrl?: string; // Made optional
    linesCommitted: number;
}

export default function WeeklyMvp({ name, avatarUrl, linesCommitted }: WeeklyMvpProps) {
    const [imgError, setImgError] = useState(false)

    // Use a generated avatar with the user's initials if no avatarUrl is provided or if the image failed to load
    const imgSrc = (avatarUrl && !imgError)
        ? avatarUrl
        : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`

    return (
        <div className={cn("w-full h-full flex bg-[linear-gradient(90deg,#077CF133_24%,#E333A333_51%,#FFB05F33_83%,#FFD4A733_100%)] rounded-3xl")}>
            <img
                src={imgSrc}
                alt={name}
                className={cn("w-[175px] h-[175px] rounded-full my-auto ml-5")}
                onError={() => setImgError(true)}
            />
            <div className={cn("flex flex-col justify-center items-center ml-6 font-[]")}>
                <h1 className={cn("font-extrabold text-4xl")}>{name}</h1>
                <p className={cn("")}>Lines Committed: {linesCommitted}</p>
            </div>
        </div>
    )
}