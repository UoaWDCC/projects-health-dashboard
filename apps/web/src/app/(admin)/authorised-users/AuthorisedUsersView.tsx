'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, Plus, Search } from 'lucide-react'
import { z } from 'zod'
import Modal from '@/components/ui/Modal'
import ErrorMessage from '@/components/utils/ErrorMessage'
import FieldError from '@/components/utils/FieldError'
import { BORDER_DEFAULT, inputClass, inputErrorClass, labelClass } from '@/lib/admin/layout'
import { addAuthorisedUserSchema } from '@/lib/schemas/authorised-users'
import {
  AUTHORISED_ROLES,
  ROLE_LABELS,
  countByRole,
  displayNameFor,
  filterUsers,
  formatAddedDate,
  formatLastActive,
  initialsFor,
  type AuthorisedRole,
  type AuthorisedUser,
  type RoleFilter,
} from '@/lib/admin/authorised-users'

interface AuthorisedUsersViewProps {
  users: AuthorisedUser[]
  /** The signed-in admin, so their own row can be protected from self-demotion. */
  currentUserId: string
}

/** Column widths shared by the table head and every row so they stay aligned. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_130px_130px_150px_240px] items-center gap-4 px-6'

// The label takes the same hue as the dot so each badge reads as one colour.
const ROLE_BADGE: Record<AuthorisedRole, { pill: string; dot: string; text: string }> = {
  ADMIN: { pill: 'bg-wdcc-blue-light', dot: 'bg-wdcc-blue', text: 'text-wdcc-blue' },
  EXEC: { pill: 'bg-wdcc-peach', dot: 'bg-wdcc-amber', text: 'text-wdcc-amber' },
}

const FILTER_TABS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  ...AUTHORISED_ROLES.map((role) => ({ value: role as RoleFilter, label: ROLE_LABELS[role] })),
]

// `appearance-none` drops the native arrow, so RoleSelect draws its own and
// reserves room for it on the right.
const selectClass = `w-full ${inputClass} appearance-none cursor-pointer pr-10`

type Dialog =
  | { kind: 'add' }
  | { kind: 'change'; user: AuthorisedUser }
  | { kind: 'remove'; user: AuthorisedUser }
  | null

export default function AuthorisedUsersView({ users, currentUserId }: AuthorisedUsersViewProps) {
  const router = useRouter()

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isRefreshing, startTransition] = useTransition()

  // Relative times depend on the viewer's clock, so they are only rendered
  // after mount to keep the server and client markup identical.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => setNow(new Date()), [])

  const counts = useMemo(() => countByRole(users), [users])
  const visible = useMemo(
    () => filterUsers(users, { search, role: roleFilter }),
    [users, search, roleFilter]
  )

  const busy = submitting || isRefreshing

  /** Runs a mutation, then re-renders the server component to pick up the change. */
  const mutate = async (
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body?: unknown
  ): Promise<string | null> => {
    setSubmitting(true)
    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        return data?.error ?? 'Something went wrong. Please try again.'
      }

      setDialog(null)
      startTransition(() => router.refresh())
      return null
    } catch {
      return 'Could not reach the server. Please try again.'
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Header band */}
      <div className="w-full bg-wdcc-blue-light px-5 sm:px-10 lg:px-20 py-14">
        <div className="flex flex-row justify-between items-end gap-8">
          <div className="flex flex-col gap-y-2">
            <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[clamp(2rem,4.5vw,3.5rem)]">
              WDCC Admin and Exec
            </h1>
            <p className="font-mono text-wdcc-grey text-sm">
              {counts.total} authorised account{counts.total === 1 ? '' : 's'} &middot;{' '}
              {counts.admin} admin &middot; {counts.exec} exec
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDialog({ kind: 'add' })}
            className="shrink-0 flex items-center gap-2 rounded-full bg-wdcc-blue text-white font-medium text-[15px] px-6 py-3 shadow-[0_6px_16px_rgba(7,124,241,0.35)] hover:bg-wdcc-blue/85 transition-colors"
          >
            <Plus size={18} strokeWidth={3} />
            Add user
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 sm:px-10 lg:px-20 pt-10 flex items-center gap-6">
        <div className="relative w-full max-w-[380px]">
          <Search
            size={16}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-wdcc-grey-light pointer-events-none"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email..."
            aria-label="Search authorised users by email"
            className="w-full font-mono text-sm text-wdcc-oshan bg-white border-[1.5px] rounded-full pl-11 pr-4 py-3 outline-none focus:border-wdcc-blue focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
          />
        </div>

        <div
          role="tablist"
          aria-label="Filter by role"
          className="flex items-center gap-1 bg-[#EDF0FA] rounded-full p-1.5 shrink-0"
        >
          {FILTER_TABS.map((tab) => {
            const active = roleFilter === tab.value
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRoleFilter(tab.value)}
                className={`rounded-full px-6 py-2 text-sm transition-all ${
                  active
                    ? 'bg-white text-wdcc-oshan font-semibold shadow-[0_2px_6px_rgba(31,32,49,0.12)]'
                    : 'text-wdcc-grey hover:text-wdcc-oshan'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <p className="ml-auto font-mono text-sm text-wdcc-grey-light shrink-0">
          Showing {visible.length} of {counts.total}
        </p>
      </div>

      {/* Table */}
      <div className="px-5 sm:px-10 lg:px-20 pt-6 pb-24">
        <div
          style={{
            borderRadius: '24px',
            border: '3px solid transparent',
            background: BORDER_DEFAULT,
          }}
        >
          <div className="rounded-[21px] overflow-hidden">
            <div
              className={`${GRID} bg-[#F5F7FD] py-4 font-mono text-[16px] uppercase  text-wdcc-grey`}
            >
              <span>Name & Email</span>
              <span>Role</span>
              <span>Added</span>
              <span>Last active</span>
              <span className="text-right">Actions</span>
            </div>

            {visible.length === 0 ? (
              <p className="font-mono text-sm text-wdcc-grey-light text-center py-16">
                {counts.total === 0
                  ? 'No admins or execs yet. Add one to get started.'
                  : 'No authorised users match this search.'}
              </p>
            ) : (
              <ul className="divide-y divide-[#EDEFF7]">
                {visible.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    now={now}
                    isSelf={user.id === currentUserId}
                    disabled={busy}
                    onChangeRole={() => setDialog({ kind: 'change', user })}
                    onRemove={() => setDialog({ kind: 'remove', user })}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {dialog?.kind === 'add' && (
        <AddUserDialog busy={busy} onClose={() => setDialog(null)} onSubmit={mutate} />
      )}
      {dialog?.kind === 'change' && (
        <ChangeRoleDialog
          user={dialog.user}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={mutate}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveUserDialog
          user={dialog.user}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={mutate}
        />
      )}
    </>
  )
}

// --- Row --------------------------------------------------------------------

function UserRow({
  user,
  now,
  isSelf,
  disabled,
  onChangeRole,
  onRemove,
}: {
  user: AuthorisedUser
  now: Date | null
  isSelf: boolean
  disabled: boolean
  onChangeRole: () => void
  onRemove: () => void
}) {
  const selfHint = 'You cannot change your own access'

  return (
    <li className={`${GRID} py-4 hover:bg-[#FBFCFF] transition-colors`}>
      <div className="flex items-center gap-3.5 min-w-0">
        <span
          aria-hidden
          className="shrink-0 w-9 h-9 rounded-full bg-wdcc-blue-light flex items-center justify-center font-mono text-[11px] font-semibold text-wdcc-blue"
        >
          {initialsFor(user)}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-wdcc-oshan truncate">{displayNameFor(user)}</p>
          <p className="font-mono text-xs text-wdcc-grey-light truncate">{user.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {user.roles.map((role) => (
          <span
            key={role}
            className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium ${ROLE_BADGE[role].pill} ${ROLE_BADGE[role].text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${ROLE_BADGE[role].dot}`} />
            {ROLE_LABELS[role]}
          </span>
        ))}
      </div>

      <span className="font-mono text-sm text-wdcc-oshan">{formatAddedDate(user.addedAt)}</span>

      <span className="font-mono text-sm text-wdcc-grey-light" suppressHydrationWarning>
        {now ? formatLastActive(user.lastSignInAt, now) : ''}
      </span>

      <div className="flex items-center justify-end gap-2.5">
        <button
          type="button"
          onClick={onChangeRole}
          disabled={disabled || isSelf}
          title={isSelf ? selfHint : undefined}
          className="font-mono text-xs text-wdcc-blue border-[1.5px] border-wdcc-blue rounded-lg px-4 py-2.5 hover:bg-wdcc-blue/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
        >
          change role
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled || isSelf}
          title={isSelf ? selfHint : undefined}
          className="font-mono text-xs text-white bg-wdcc-kelvin rounded-lg px-4 py-2.5 hover:bg-wdcc-kelvin/85 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-wdcc-kelvin"
        >
          remove
        </button>
      </div>
    </li>
  )
}

// --- Dialogs ----------------------------------------------------------------

type SubmitFn = (
  url: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body?: unknown
) => Promise<string | null>

function DialogActions({
  onCancel,
  confirmLabel,
  busy,
  danger = false,
}: {
  onCancel: () => void
  confirmLabel: string
  busy: boolean
  danger?: boolean
}) {
  return (
    <div className="flex justify-end gap-3 mt-6">
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="font-mono text-sm text-wdcc-grey border-[1.5px] border-wdcc-purple rounded-xl px-5 py-2.5 hover:bg-[#f8f8fc] transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={busy}
        className={`font-mono text-sm font-semibold text-white rounded-xl px-6 py-2.5 transition-colors disabled:opacity-50 ${
          danger ? 'bg-wdcc-kelvin hover:bg-wdcc-kelvin/85' : 'bg-wdcc-blue hover:bg-wdcc-blue/85'
        }`}
      >
        {busy ? 'Working...' : confirmLabel}
      </button>
    </div>
  )
}

function RoleSelect({
  value,
  onChange,
  id = 'role',
}: {
  value: AuthorisedRole
  onChange: (role: AuthorisedRole) => void
  id?: string
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name="role"
        value={value}
        onChange={(event) => onChange(event.target.value as AuthorisedRole)}
        className={selectClass}
      >
        {AUTHORISED_ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </select>
      <ChevronDown
        size={16}
        aria-hidden
        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-wdcc-grey pointer-events-none"
      />
    </div>
  )
}

function AddUserDialog({
  busy,
  onClose,
  onSubmit,
}: {
  busy: boolean
  onClose: () => void
  onSubmit: SubmitFn
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<AuthorisedRole>('ADMIN')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const validation = addAuthorisedUserSchema.safeParse({ email: email.trim(), role })
    if (!validation.success) {
      const errors = z.flattenError(validation.error).fieldErrors
      setFieldErrors({ email: errors.email?.[0] ?? '', role: errors.role?.[0] ?? '' })
      return
    }

    setFieldErrors({})
    const message = await onSubmit('/api/authorised-users', 'POST', validation.data)
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add user"
      description="Grant admin or exec access to someone who has already signed in with their WDCC Google account."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-user-email" className={labelClass}>
            Email <span className="text-wdcc-kelvin">*</span>
          </label>
          <input
            id="add-user-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            placeholder="name@wdcc.co.nz"
            className={`w-full ${fieldErrors.email ? inputErrorClass : inputClass}`}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-user-role" className={labelClass}>
            Role <span className="text-wdcc-kelvin">*</span>
          </label>
          <RoleSelect id="add-user-role" value={role} onChange={setRole} />
          <FieldError message={fieldErrors.role} />
        </div>

        {error && <ErrorMessage message={error} />}

        <DialogActions onCancel={onClose} confirmLabel="Add" busy={busy} />
      </form>
    </Modal>
  )
}

function ChangeRoleDialog({
  user,
  busy,
  onClose,
  onSubmit,
}: {
  user: AuthorisedUser
  busy: boolean
  onClose: () => void
  onSubmit: SubmitFn
}) {
  // Default to the role they are not currently on, so "Save" is meaningful.
  const [role, setRole] = useState<AuthorisedRole>(user.roles.includes('ADMIN') ? 'EXEC' : 'ADMIN')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const message = await onSubmit(`/api/authorised-users/${user.id}`, 'PATCH', { role })
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change role"
      description={
        <>
          {displayNameFor(user)} ({user.email}) is currently{' '}
          {user.roles.map((current) => ROLE_LABELS[current]).join(' and ')}. Choosing a role
          replaces their existing access.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="change-role" className={labelClass}>
            New role
          </label>
          <RoleSelect id="change-role" value={role} onChange={setRole} />
        </div>

        {error && <ErrorMessage message={error} />}

        <DialogActions onCancel={onClose} confirmLabel="Save" busy={busy} />
      </form>
    </Modal>
  )
}

function RemoveUserDialog({
  user,
  busy,
  onClose,
  onSubmit,
}: {
  user: AuthorisedUser
  busy: boolean
  onClose: () => void
  onSubmit: SubmitFn
}) {
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    const message = await onSubmit(`/api/authorised-users/${user.id}`, 'DELETE')
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Remove access"
      description={
        <>
          {displayNameFor(user)} ({user.email}) will lose their{' '}
          {user.roles.map((role) => ROLE_LABELS[role]).join(' and ')} access. Their account and
          contribution history are not affected, and you can add them back later.
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && <ErrorMessage message={error} />}
        <DialogActions onCancel={onClose} confirmLabel="Remove" busy={busy} danger />
      </form>
    </Modal>
  )
}
