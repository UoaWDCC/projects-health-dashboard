'use client'

import { useEffect, useState, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

interface ScrollRevealOnScrollProps {
  children: ReactNode
  className?: string
  revealAt?: number
}

export default function RevealOnScroll({
  children,
  className,
  revealAt = 72,
}: ScrollRevealOnScrollProps): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => {
      setIsVisible(window.scrollY >= revealAt)
    }

    updateVisibility()
    window.addEventListener('scroll', updateVisibility, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateVisibility)
    }
  }, [revealAt])

  return (
    <section
      className={cn(
        'transition-all duration-500 ease-out',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5 pointer-events-none',
        className
      )}
    >
      {children}
    </section>
  )
}
