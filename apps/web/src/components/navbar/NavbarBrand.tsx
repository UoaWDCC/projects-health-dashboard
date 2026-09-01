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
          className="flex xl:hidden items-center gap-2 font-figtree text-[16px] text-wdcc-oshan font-semibold whitespace-nowrap"
        >
          <ArrowLeft className="w-6 h-6" strokeWidth={2.5} />
          <span>Projects</span>
        </Link>
      )}

      {/* Logo + wordmark */}
      <Link
        href="/"
        className={`items-center gap-2 ${isProjectDetail ? 'hidden xl:flex' : 'flex'}`}
      >
        <Image src="/logo.svg" alt="WDCC Logo" width={60} height={40} />
        <span className="hidden xl:inline-block text-[16px] mb-0.5 xl:text-[20px] text-wdcc-blue leading-none font-cartograph-mono-cf uppercase whitespace-nowrap">
          Projects Health Dashboard
        </span>
      </Link>
    </>
  )
}
