import { createClient } from '@/lib/supabase/server'
import { getUserRoles } from '@/lib/auth'
import { Role } from '@repo/db'
import { ProfileDropdown } from './ProfileDropdown'
import Image from 'next/image'
import Link from 'next/link'

export async function Navbar() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const roles = user ? await getUserRoles() : []
  const isExec = roles.includes(Role.EXEC)
  const isAdmin = roles.includes(Role.ADMIN)

  const profileUser = user
    ? {
        email: user.email,
        avatarUrl: user.user_metadata?.avatar_url as string | undefined,
        displayName: (user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email) as
          | string
          | undefined,
      }
    : null

  return (
    <header className="sticky top-0 flex items-center justify-between px-6 xl:px-12 h-16 bg-white/65 border-b border-gray-200">
      <div className="flex items-center gap-4 xl:gap-6">
        <Link href="/">
          <Image src="/logo.svg" alt="WDCC Logo" width={80} height={40} />
        </Link>
        <span className="text-[16px] xl:text-[24px] text-wdcc-blue leading-none translate-y-[3px] font-courier-prime">
          PROJECT HEALTH DASHBOARD
        </span>
      </div>
      <div className="flex items-center gap-4 xl:gap-10 text-[16px]">
        <div className="flex gap-4 xl:gap-8 font-figtree">
          <Link href="/">{'( Projects )'}</Link>
          <Link href="/leaderboard">{'( Leaderboard )'}</Link>
        </div>

        <div className="flex items-center gap-2 xl:gap-4 font-arial text-[16px]">
          {(isExec || isAdmin) && (
            <Link
              href="/exec-dashboard"
              className="rounded-full bg-wdcc-oshan text-white hover:bg-gray-300 px-4 py-1.5"
            >
              Exec dashboard
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin-dashboard"
              className="rounded-full bg-wdcc-oshan text-white hover:bg-gray-300 px-4 py-1.5"
            >
              Admin dashboard
            </Link>
          )}
          <ProfileDropdown user={profileUser} />
        </div>
      </div>
    </header>
  )
}
