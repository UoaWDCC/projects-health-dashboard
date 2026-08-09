// Domain helpers and data access for the Authorised Users admin page.

import { db, Role } from '@repo/db'

/** The roles this page can grant. A subset of the DB `Role` enum. */
export const AUTHORISED_ROLES = ['ADMIN', 'EXEC'] as const

export type AuthorisedRole = (typeof AUTHORISED_ROLES)[number]

/** Tabs in the role filter. `ALL` shows every authorised account. */
export type RoleFilter = 'ALL' | AuthorisedRole

export function isAuthorisedRole(value: unknown): value is AuthorisedRole {
  return typeof value === 'string' && (AUTHORISED_ROLES as readonly string[]).includes(value)
}

/** One row in the authorised users table. Dates are ISO strings so the row can
 *  cross the server -> client component boundary without serialisation loss. */
export type AuthorisedUser = {
  /** Supabase auth user UUID — also the Profile primary key. */
  id: string
  email: string
  displayName: string | null
  /** Authorised roles held, ADMIN before EXEC. Never empty. */
  roles: AuthorisedRole[]
  /** The date the first authorised role was granted. */
  addedAt: string
  lastSignInAt: string | null
}

export const ROLE_LABELS: Record<AuthorisedRole, string> = {
  ADMIN: 'Admin',
  EXEC: 'Exec',
}

/** Sorts a set of roles into display order (ADMIN first) and drops non-authorised ones. */
export function toAuthorisedRoles(roles: readonly string[]): AuthorisedRole[] {
  return AUTHORISED_ROLES.filter((role) => roles.includes(role))
}

// --- Display name / initials ------------------------------------------------

/** Falls back to the local part of the email when a profile has no display name. */
export function displayNameFor(user: Pick<AuthorisedUser, 'displayName' | 'email'>): string {
  const name = user.displayName?.trim()
  if (name) return name
  return user.email.split('@')[0] ?? user.email
}

/** Up to two uppercase initials for the avatar circle, e.g. "Sione Faleolo" -> "SF". */
export function initialsFor(user: Pick<AuthorisedUser, 'displayName' | 'email'>): string {
  const words = displayNameFor(user)
    .split(/[\s._-]+/)
    .filter(Boolean)

  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

// --- Filtering --------------------------------------------------------------

/** Case-insensitive substring match over email and display name. */
export function matchesSearch(user: AuthorisedUser, search: string): boolean {
  const query = search.trim().toLowerCase()
  if (!query) return true
  return (
    user.email.toLowerCase().includes(query) || displayNameFor(user).toLowerCase().includes(query)
  )
}

export function filterUsers(
  users: readonly AuthorisedUser[],
  { search, role }: { search: string; role: RoleFilter }
): AuthorisedUser[] {
  return users.filter(
    (user) => (role === 'ALL' || user.roles.includes(role)) && matchesSearch(user, search)
  )
}

/** Counts for the header line. A dual-role account is counted under both roles. */
export function countByRole(users: readonly AuthorisedUser[]): {
  total: number
  admin: number
  exec: number
} {
  return {
    total: users.length,
    admin: users.filter((user) => user.roles.includes('ADMIN')).length,
    exec: users.filter((user) => user.roles.includes('EXEC')).length,
  }
}

// --- Date formatting --------------------------------------------------------

const ADDED_FORMAT: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  // Pinned to UTC so the server and client render identical text — a
  // timezone-dependent date would cause a hydration mismatch.
  timeZone: 'UTC',
}

/** e.g. "12 Feb 2026". Day-first to match the design. */
export function formatAddedDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-NZ', ADDED_FORMAT).format(date)
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Coarse "last active" label: "Just now", "N min ago", "Today", "Yesterday",
 * "N days ago", then falls back to an absolute date.
 *
 * `now` is injectable because the caller only has a clock after mount — the
 * server render has no viewer timezone to resolve "Today" against.
 */
export function formatLastActive(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'Never'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'

  const elapsed = now.getTime() - date.getTime()

  if (elapsed < MINUTE_MS) return 'Just now'
  if (elapsed < HOUR_MS) return `${Math.floor(elapsed / MINUTE_MS)} min ago`

  const dayDelta = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000)
  if (dayDelta <= 0) return 'Today'
  if (dayDelta === 1) return 'Yesterday'
  if (dayDelta < 7) return `${dayDelta} days ago`

  return formatAddedDate(iso)
}

// --- Data access ------------------------------------------------------------
//
// Callers are responsible for the ADMIN check — the API routes use `hasRole`
// from @/lib/auth, as every other route in the app does.

/** The DB `Role` values this page is allowed to grant or revoke. */
const GRANTABLE_ROLES: Role[] = [...AUTHORISED_ROLES] as Role[]

/**
 * Every Profile holding ADMIN or EXEC.
 *
 * Ordered admin-first then by grant date so the table reads the same way as the
 * design without the client having to re-sort.
 */
export async function listAuthorisedUsers(): Promise<AuthorisedUser[]> {
  const profiles = await db.profile.findMany({
    where: { roles: { some: { role: { in: GRANTABLE_ROLES } } } },
    select: {
      id: true,
      email: true,
      displayName: true,
      createdAt: true,
      lastSignInAt: true,
      roles: { select: { role: true, createdAt: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  return profiles
    .map((profile) => {
      // Only ADMIN/EXEC grants count towards the date — a MEMBER row, which
      // this page does not manage, would otherwise skew it.
      const grants = profile.roles.filter((userRole) => isAuthorisedRole(userRole.role))
      const lastGrantedAt = grants.reduce<Date | null>(
        (latest, grant) => (!latest || grant.createdAt > latest ? grant.createdAt : latest),
        null
      )

      return {
        id: profile.id,
        email: profile.email,
        displayName: profile.displayName,
        roles: toAuthorisedRoles(grants.map((grant) => grant.role)),
        // `where` guarantees at least one grant; fall back defensively anyway.
        addedAt: (lastGrantedAt ?? profile.createdAt).toISOString(),
        lastSignInAt: profile.lastSignInAt?.toISOString() ?? null,
      }
    })
    .sort((a, b) => {
      // ADMIN block first, then EXEC; stable by grant date within each block.
      const rank = (user: AuthorisedUser) => (user.roles.includes('ADMIN') ? 0 : 1)
      return rank(a) - rank(b) || a.addedAt.localeCompare(b.addedAt)
    })
}

/**
 * Replaces a profile's authorised roles with exactly `role`.
 *
 * Clears every authorised role first, `role` included, so the replacement row
 * carries a fresh `createdAt` timestamp.
 */
export async function setAuthorisedRole(userId: string, role: AuthorisedRole): Promise<void> {
  await db.$transaction([
    db.userRole.deleteMany({ where: { userId, role: { in: GRANTABLE_ROLES } } }),
    db.userRole.create({ data: { userId, role: role as Role } }),
  ])
}

/** Revokes every authorised role, removing the profile from the page's list. */
export async function revokeAuthorisedRoles(userId: string): Promise<void> {
  await db.userRole.deleteMany({ where: { userId, role: { in: GRANTABLE_ROLES } } })
}
