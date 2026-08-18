import { createClient } from '@/lib/supabase/server'
import { getUserRoles } from '@/lib/auth'
import { Role } from '@repo/db'
import { ProfileDropdown } from './ProfileDropdown'
import { NavbarBrand } from './NavbarBrand'
import { NavbarMobile } from './NavbarMobile'
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
    <>
      <header className="z-50 sticky top-0 flex items-center justify-between px-5 sm:px-10 lg:px-20 h-16 bg-white/65 border-b border-gray-200 backdrop-blur-sm">
        <NavbarBrand />
        <div className="flex items-center gap-4 xl:gap-10 text-[16px]">
          <div className="hidden lg:flex gap-4 xl:gap-8 font-figtree">
            <Link href={isAdmin ? '/metric-weighting' : '/'} className="group flex items-center">
              <span className="inline-block -translate-x-0.5 transition-transform duration-200 ease-out group-hover:translate-x-1">
                {'('}
              </span>
              <span className="px-1 whitespace-nowrap">
                {isAdmin ? 'Metric Weighting' : 'Projects'}
              </span>
              <span className="inline-block translate-x-0.5 transition-transform duration-200 ease-out group-hover:-translate-x-1">
                {')'}
              </span>
            </Link>
            <Link
              href={isAdmin ? '/admin-dashboard/auth-list' : '/leaderboard'}
              className="group flex items-center "
            >
              <span className="inline-block -translate-x-0.5 transition-transform duration-200 ease-out group-hover:translate-x-1">
                {'('}
              </span>
              <span className="px-1 whitespace-nowrap">
                {isAdmin ? 'Authorised Users' : 'Leaderboard'}
              </span>
              <span className="inline-block translate-x-0.5 transition-transform duration-200 ease-out group-hover:-translate-x-1">
                {')'}
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-2 xl:gap-4 font-arial text-[16px]">
            {(isExec || isAdmin) && (
              <Link
                href="/exec-dashboard"
                className="hidden lg:block rounded-full bg-wdcc-oshan text-white hover:bg-gray-300 px-4 py-1.5 whitespace-nowrap"
              >
                Exec dashboard
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin-dashboard"
                className="hidden lg:block rounded-full bg-wdcc-oshan text-white hover:bg-gray-300 px-4 py-1.5 whitespace-nowrap"
              >
                Admin dashboard
              </Link>
            )}
            <ProfileDropdown user={profileUser} />
          </div>
        </div>
      </header>
      <div className="lg:hidden">
        <NavbarMobile />
      </div>
    </>
  )
}
