'use client'

import { usePathname } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

/**
 * Left-hand side of the navbar.
 */
export function NavbarBrand() {
  const pathname = usePathname()
  const isProjectDetail = /^\/project\/[^/]+/.test(pathname ?? '')

  return (
    <>
      {/* Mobile-only back link, only on project detail pages */}
      {isProjectDetail && (
        <Link
          href="/"
          className="flex lg:hidden items-center gap-2 font-figtree text-[16px] text-wdcc-oshan font-semibold"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          <span>Projects</span>
        </Link>
      )}

      {/* Logo + wordmark */}
      <Link
        href="/"
        className={`items-center gap-4 xl:gap-6 ${isProjectDetail ? 'hidden lg:flex' : 'flex'}`}
      >
        <Image src="/logo.svg" alt="WDCC Logo" width={60} height={40} />
        <span className="text-[16px] xl:text-[24px] text-wdcc-blue leading-none font-cartograph-mono-cf uppercase">
          Projects Health Dashboard
        </span>
      </Link>
    </>
  )
}
