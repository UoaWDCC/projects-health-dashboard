'use client'

import { useState, useRef, useEffect } from 'react'
import Image from 'next/image'
import { signInWithGoogle } from '@/lib/auth-utils/oauth'
import { signOut } from '@/lib/auth-utils/signout'

interface ProfileUser {
  email: string | undefined
  avatarUrl: string | undefined
  displayName: string | undefined
}

export function ProfileDropdown({ user }: { user: ProfileUser | null }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const initials =
    user?.displayName
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) ?? '?'

  return (
    <div ref={ref} className="relative ">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-label="Open profile menu"
        aria-expanded={open}
        className="rounded-full px-2 py-1 flex items-center gap-2 bg-white/60 border border-wdcc-blue/[18%] hover:bg-gray-50"
      >
        {user &&
          (user.avatarUrl ? (
            <Image
              src={user.avatarUrl}
              alt={user.displayName ?? 'Profile picture'}
              width={36}
              height={36}
              className="rounded-full object-cover border-2 border-gray-200"
            />
          ) : (
            <span className="flex items-center justify-center w-9 h-9 rounded-full">
              {initials}
            </span>
          ))}
        <span className={`text-sm  font-sans`}>{user?.displayName ?? 'Sign in'}</span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 rounded-lg shadow-lg bg-white ring-1 ring-black/5 z-50 overflow-hidden">
          {user ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100">
                <p className={`text-sm font-sans`}>{user.displayName}</p>
                <p className={`text-xs font-sans`}>{user.email}</p>
              </div>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
                >
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <form action={signInWithGoogle}>
              <button
                type="submit"
                className="flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50"
              >
                <GoogleIcon />
                Sign in with Google
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  )
}
