'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'

export function NavbarMobile() {
  const currentPath = usePathname()
  const isProjectPage = currentPath === '/' || currentPath.startsWith('/project')
  const isLeaderboardPage = currentPath === '/leaderboard'

  return (
    <div className="z-50 fixed left-1/2 -translate-x-1/2 bottom-3 w-[93vw] bg-slate-50/85 backdrop-blur-sm shadow-xl rounded-3xl border border-[#14182B0F] py-5 flex justify-around">
      <div className="flex justify-between w-[60vw]">
        <Link href="/" className="text-center flex flex-col items-center">
          <Image
            src={isProjectPage ? '/folder-icon-active.svg' : '/folder-icon.svg'}
            alt="folder icon"
            width={22}
            height={22}
          />
          <span
            className={`font-mono text-sm ${isProjectPage ? 'text-[#1F6FF0]' : 'text-[#9AA0B0]'}`}
          >
            Projects
          </span>
        </Link>
        <Link href="/leaderboard" className="text-center flex flex-col items-center">
          <Image
            src={isLeaderboardPage ? '/trophy-icon-active.svg' : '/trophy-icon.svg'}
            alt="trophy icon"
            width={22}
            height={22}
          />
          <span
            className={`font-mono text-sm ${isLeaderboardPage ? 'text-[#1F6FF0]' : 'text-[#9AA0B0]'}`}
          >
            Leaderboard
          </span>
        </Link>
      </div>
    </div>
  )
}
