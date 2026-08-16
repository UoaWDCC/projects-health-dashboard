'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import ClientSuspense from '@/components/utils/ClientSuspense'
import ErrorMessage from '@/components/utils/ErrorMessage'
import FieldError from '@/components/utils/FieldError'
import Modal from '@/components/ui/Modal'
import { BORDER_DEFAULT, inputClass, inputErrorClass, labelClass } from '@/lib/admin/layout'
import { rolesSchema } from '@/lib/schemas/admin'
import z from 'zod'

/** Role names as they arrive over JSON — the API serialises the Prisma enum to plain strings. */
type RoleName = 'ADMIN' | 'EXEC'

type RoleFilter = 'ALL' | RoleName

type AuthUser = {
  id: string
  email: string
  displayName: string | null
  roles: RoleName[]
  /** ISO date of the first admin/exec grant. */
  addedAt: string
  /** ISO date of the last sign-in, or null when they have never signed in. */
  lastActiveAt: string | null
  isPending: boolean
}

type Status = { ok: boolean; message: string } | null

/** Which dialog is open, and the row it acts on. */
type Dialog =
  | { kind: 'add' }
  | { kind: 'change'; user: AuthUser }
  | { kind: 'remove'; user: AuthUser }
  | null

/** Roles as the API takes them: one boolean per grantable role. */
type RoleSelection = { adminRole: boolean; execRole: boolean }

/** Sends a mutation to /api/roles, returning an error message or null on success. */
type SubmitFn = (
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  successMessage: string
) => Promise<string | null>

const FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'EXEC', label: 'Exec' },
]

/** Two-letter monogram for the avatar: initials when we have a name, otherwise the email. */
function getInitials(user: AuthUser) {
  const source = user.displayName?.trim() || user.email
  const parts = source.split(/[\s._@-]+/).filter(Boolean)
  const letters = (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
  return (letters || source.slice(0, 2)).toUpperCase()
}

function formatAdded(iso: string) {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function formatLastActive(iso: string | null) {
  if (!iso) return 'Never'

  const then = new Date(iso)
  const minutes = Math.floor((Date.now() - then.getTime()) / 60_000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  if (then >= startOfToday) return 'Today'

  const startOfYesterday = new Date(startOfToday)
  startOfYesterday.setDate(startOfYesterday.getDate() - 1)
  if (then >= startOfYesterday) return 'Yesterday'

  return formatAdded(iso)
}

function describeRoles(roles: RoleName[]) {
  return roles.map((role) => (role === 'ADMIN' ? 'Admin' : 'Exec')).join(' and ')
}

export default function AuthListPage() {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<Status>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL')
  const [dialog, setDialog] = useState<Dialog>(null)
  const [submitting, setSubmitting] = useState(false)

  const fetchList = useCallback(async () => {
    try {
      const res = await fetch('/api/roles', { method: 'GET' })
      const data = await res.json()
      if (!res.ok) {
        setStatus({ ok: false, message: data?.error ?? 'Unknown error' })
        return
      }
      setUsers(data.users)
      setCurrentUserEmail(data.currentUserEmail)
    } catch {
      setStatus({ ok: false, message: 'Server error or response failed to parse' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  /**
   * Runs a mutation against /api/roles and refreshes the list on success.
   * Resolves to an error message for the dialog to show, or null when it worked.
   */
  const mutate = useCallback(
    async (
      method: 'POST' | 'PATCH' | 'DELETE',
      body: unknown,
      successMessage: string
    ): Promise<string | null> => {
      setSubmitting(true)
      try {
        const res = await fetch('/api/roles', {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const data = await res.json().catch(() => null)

        if (!res.ok) {
          return data?.error ?? 'Unknown error'
        }

        setDialog(null)
        setStatus({ ok: true, message: successMessage })
        await fetchList()
        return null
      } catch {
        return 'Server error or response failed to parse'
      } finally {
        setSubmitting(false)
      }
    },
    [fetchList]
  )

  const adminCount = users.filter((user) => user.roles.includes('ADMIN')).length
  const execCount = users.filter((user) => user.roles.includes('EXEC')).length

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase()

    return users.filter((user) => {
      const matchesRole = roleFilter === 'ALL' || user.roles.includes(roleFilter)
      const matchesSearch =
        query === '' ||
        user.email.toLowerCase().includes(query) ||
        (user.displayName?.toLowerCase().includes(query) ?? false)

      return matchesRole && matchesSearch
    })
  }, [users, search, roleFilter])

  return (
    <>
      {/* Header band */}
      <div className="w-full bg-wdcc-blue-light px-5 sm:px-10 lg:px-20 pt-12 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h1 className="text-wdcc-oshan font-extrabold tracking-tight !leading-none m-0 text-[clamp(2rem,5vw,3.5rem)]">
              WDCC Admin and Exec
            </h1>
            <p className="font-mono text-wdcc-grey text-sm sm:text-base">
              {users.length} authorised account{users.length === 1 ? '' : 's'} &middot; {adminCount}{' '}
              admin &middot; {execCount} exec
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDialog({ kind: 'add' })}
            className="flex items-center gap-2 rounded-full bg-wdcc-blue text-white font-sans text-base font-bold px-7 py-3.5 hover:bg-wdcc-blue/85 transition-colors duration-150 shrink-0"
          >
            <span className="text-lg leading-none">+</span>
            Add user
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-10 lg:px-20 py-10 flex flex-col gap-6">
        {/* Status banner */}
        {status && (
          <div
            className={`flex items-center gap-2 rounded-xl px-4 py-3 font-mono text-xs ${
              status.ok
                ? 'bg-wdcc-mint border border-green-200 text-green-700'
                : 'bg-wdcc-kelvin/10 border border-wdcc-kelvin/20 text-wdcc-kelvin'
            }`}
          >
            {status.ok ? '✓' : '✗'}&nbsp;{status.message}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-4">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by email…"
            aria-label="Search by email"
            className="flex-1 min-w-[220px] max-w-md font-mono text-sm text-wdcc-oshan bg-white border-[1.5px] border-wdcc-purple rounded-full px-6 py-3.5 outline-none focus:border-wdcc-blue focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
          />

          <div className="flex items-center gap-1 rounded-full bg-wdcc-grey-light/15 p-1.5 shrink-0">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setRoleFilter(filter.value)}
                className={`rounded-full px-6 py-2.5 font-sans text-sm transition-colors duration-150 ${
                  roleFilter === filter.value
                    ? 'bg-white text-wdcc-oshan font-bold shadow-sm'
                    : 'text-wdcc-grey font-medium hover:text-wdcc-oshan'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <span className="ml-auto font-mono text-sm text-wdcc-grey-light shrink-0">
            Showing {visibleUsers.length} of {users.length}
          </span>
        </div>

        {/* Table */}
        <ClientSuspense
          loading={loading}
          fallback={<p className="font-mono text-sm text-wdcc-grey-light">Loading…</p>}
        >
          <div
            style={{
              borderRadius: '24px',
              border: '3px solid transparent',
              background: BORDER_DEFAULT,
            }}
          >
            <div className="overflow-x-auto rounded-[21px]">
              <table className="w-full min-w-[880px] border-collapse">
                <thead>
                  <tr className="bg-[#F4F7FC]">
                    <th className={`${thClass} text-left`}>Name &amp; Email</th>
                    <th className={`${thClass} text-left`}>Role</th>
                    <th className={`${thClass} text-left`}>Added</th>
                    <th className={`${thClass} text-left`}>Last Active</th>
                    <th className={`${thClass} text-right`}>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {visibleUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center font-mono text-sm text-wdcc-grey-light"
                      >
                        {users.length === 0
                          ? 'No admins or exec members yet.'
                          : 'No accounts match this filter.'}
                      </td>
                    </tr>
                  ) : (
                    visibleUsers.map((user) => {
                      // The API blocks this too, but disabling avoids a pointless round trip.
                      const isSelfAdmin =
                        user.roles.includes('ADMIN') && user.email === currentUserEmail

                      return (
                        <tr
                          key={user.id}
                          className="border-t border-wdcc-grey-light/20 bg-white hover:bg-wdcc-blue/[0.03] transition-colors duration-150"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3.5">
                              <div className="w-10 h-10 rounded-full bg-wdcc-blue/15 flex items-center justify-center shrink-0">
                                <span className="font-mono text-xs font-bold text-wdcc-blue">
                                  {getInitials(user)}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="font-sans font-bold text-[15px] text-wdcc-oshan truncate">
                                  {user.displayName ?? '—'}
                                </p>
                                <p className="font-mono text-[13px] text-wdcc-grey-light truncate">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {user.roles.map((role) => (
                                <RolePill key={role} role={role} />
                              ))}
                            </div>
                          </td>

                          <td className="px-6 py-4 font-mono text-sm text-wdcc-oshan whitespace-nowrap">
                            {formatAdded(user.addedAt)}
                          </td>

                          <td
                            className={`px-6 py-4 font-mono text-sm whitespace-nowrap ${
                              user.isPending ? 'text-wdcc-amber' : 'text-wdcc-grey-light'
                            }`}
                            title={user.isPending ? 'Has not signed in yet' : undefined}
                          >
                            {formatLastActive(user.lastActiveAt)}
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2.5">
                              <button
                                type="button"
                                disabled={submitting}
                                onClick={() => setDialog({ kind: 'change', user })}
                                className="rounded-lg border-[1.5px] border-wdcc-blue text-wdcc-blue font-mono text-[13px] px-4 py-2 hover:bg-wdcc-blue/5 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                              >
                                change role
                              </button>
                              <button
                                type="button"
                                disabled={isSelfAdmin || submitting}
                                title={
                                  isSelfAdmin ? 'You cannot remove your own admin role' : undefined
                                }
                                onClick={() => setDialog({ kind: 'remove', user })}
                                className="rounded-lg bg-red-700 text-white font-mono text-[13px] px-4 py-2 hover:bg-red-800 transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-red-700"
                              >
                                remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ClientSuspense>
      </div>

      {dialog?.kind === 'add' && (
        <AddUserDialog busy={submitting} onClose={() => setDialog(null)} onSubmit={mutate} />
      )}
      {dialog?.kind === 'change' && (
        <ChangeRoleDialog
          user={dialog.user}
          isSelf={dialog.user.email === currentUserEmail}
          busy={submitting}
          onClose={() => setDialog(null)}
          onSubmit={mutate}
        />
      )}
      {dialog?.kind === 'remove' && (
        <RemoveUserDialog
          user={dialog.user}
          busy={submitting}
          onClose={() => setDialog(null)}
          onSubmit={mutate}
        />
      )}
    </>
  )
}

const thClass =
  'font-mono text-[11px] uppercase tracking-[0.15em] text-wdcc-grey-light font-medium px-6 py-4'

function RolePill({ role }: { role: RoleName }) {
  const isAdmin = role === 'ADMIN'

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 font-sans text-sm font-semibold whitespace-nowrap ${
        isAdmin ? 'bg-wdcc-blue/10 text-wdcc-blue' : 'bg-wdcc-peach/70 text-[#8A5B12]'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isAdmin ? 'bg-wdcc-blue' : 'bg-wdcc-amber'}`} />
      {isAdmin ? 'Admin' : 'Exec'}
    </span>
  )
}

// --- Dialogs ----------------------------------------------------------------

/**
 * Admin and Exec are independent grants — an account can hold both — so roles are
 * picked with checkboxes rather than a single-choice control.
 */
function RoleCheckboxes({
  idPrefix,
  value,
  onChange,
  disabled,
  error,
}: {
  idPrefix: string
  value: RoleSelection
  onChange: (next: RoleSelection) => void
  disabled?: boolean
  error?: string
}) {
  const rows: { key: keyof RoleSelection; label: string }[] = [
    { key: 'adminRole', label: 'Admin' },
    { key: 'execRole', label: 'Exec' },
  ]

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>
        Roles <span className="text-wdcc-kelvin">*</span>
      </span>
      <div className="flex gap-4 items-center h-[42px]">
        {rows.map((row) => (
          <label
            key={row.key}
            htmlFor={`${idPrefix}-${row.key}`}
            className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input
              id={`${idPrefix}-${row.key}`}
              type="checkbox"
              name={row.key}
              checked={value[row.key]}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, [row.key]: event.target.checked })}
              className="w-4 h-4 rounded accent-[#077CF1]"
            />
            <span className="font-mono text-sm text-wdcc-grey">{row.label}</span>
          </label>
        ))}
      </div>
      <FieldError message={error} />
    </div>
  )
}

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
          danger ? 'bg-red-700 hover:bg-red-800' : 'bg-wdcc-blue hover:bg-wdcc-blue/85'
        }`}
      >
        {busy ? 'Working…' : confirmLabel}
      </button>
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
  const [roles, setRoles] = useState<RoleSelection>({ adminRole: false, execRole: false })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload = { email: email.trim(), ...roles }
    const validation = rolesSchema.safeParse(payload)

    if (!validation.success) {
      const errors = z.flattenError(validation.error).fieldErrors
      setFieldErrors({ email: errors.email?.[0] ?? '', role: errors.adminRole?.[0] ?? '' })
      return
    }

    setFieldErrors({})
    const message = await onSubmit('POST', validation.data, 'User added successfully')
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add user"
      description="The email does not need an account yet — the role applies on their first sign-in."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="add-user-email" className={labelClass}>
            Email <span className="text-wdcc-kelvin">*</span>
          </label>
          <input
            id="add-user-email"
            type="email"
            name="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value)
              setFieldErrors((prev) => ({ ...prev, email: '' }))
            }}
            placeholder="user@wdcc.co.nz"
            className={`w-full ${fieldErrors.email ? inputErrorClass : inputClass}`}
          />
          <FieldError message={fieldErrors.email} />
        </div>

        <RoleCheckboxes
          idPrefix="add-user"
          value={roles}
          onChange={(next) => {
            setRoles(next)
            setFieldErrors((prev) => ({ ...prev, role: '' }))
          }}
          error={fieldErrors.role}
        />

        {error && <ErrorMessage message={error} />}

        <DialogActions onCancel={onClose} confirmLabel="Add user" busy={busy} />
      </form>
    </Modal>
  )
}

function ChangeRoleDialog({
  user,
  isSelf,
  busy,
  onClose,
  onSubmit,
}: {
  user: AuthUser
  isSelf: boolean
  busy: boolean
  onClose: () => void
  onSubmit: SubmitFn
}) {
  // Pre-filled with what they hold now, so the form starts as a no-op edit.
  const [roles, setRoles] = useState<RoleSelection>({
    adminRole: user.roles.includes('ADMIN'),
    execRole: user.roles.includes('EXEC'),
  })
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload = { email: user.email, ...roles }
    const validation = rolesSchema.safeParse(payload)

    if (!validation.success) {
      const errors = z.flattenError(validation.error).fieldErrors
      // Removing every role would be a removal, not a role change.
      setFieldError(errors.adminRole?.[0] ?? 'Select at least one role')
      return
    }

    setFieldError('')
    const message = await onSubmit('PATCH', validation.data, 'Roles updated successfully')
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change role"
      description={
        <>
          {user.displayName ?? user.email} is currently {describeRoles(user.roles)}. Saving replaces
          their access with exactly what is ticked below.
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <RoleCheckboxes
          idPrefix="change-role"
          value={roles}
          onChange={(next) => {
            setRoles(next)
            setFieldError('')
          }}
          // The API rejects self-demotion, so the box that would cause it is held on.
          disabled={isSelf && roles.adminRole}
          error={fieldError}
        />

        {isSelf && (
          <p className="font-mono text-xs text-wdcc-grey">
            You cannot remove your own admin role, so your roles are locked here.
          </p>
        )}

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
  user: AuthUser
  busy: boolean
  onClose: () => void
  onSubmit: SubmitFn
}) {
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const payload = {
      email: user.email,
      adminRole: user.roles.includes('ADMIN'),
      execRole: user.roles.includes('EXEC'),
    }

    const message = await onSubmit('DELETE', payload, 'User removed successfully')
    if (message) setError(message)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Remove access"
      description={
        <>
          {user.displayName ?? user.email} ({user.email}) will lose their{' '}
          {describeRoles(user.roles)} access. Their account and contribution history are not
          affected, and you can add them back later.
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
