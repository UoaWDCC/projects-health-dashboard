'use client'

import { BORDER_DEFAULT, BORDER_HOVER } from '@/lib/admin/layout'
import Image from 'next/image'
import { useState } from 'react'

type Status = { ok: boolean; message: string } | null

export default function ManageRolesPage() {
  const [addStatus, setAddStatus] = useState<Status>(null)
  const [removeStatus, setRemoveStatus] = useState<Status>(null)

  const handleSubmit = async (
    formData: FormData,
    method: 'POST' | 'DELETE',
    setStatus: (s: Status) => void
  ) => {
    setStatus(null)
    try {
      const response = await fetch('/api/roles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.get('email'),
          adminRole: formData.get('adminRole') === 'on',
          execRole: formData.get('execRole') === 'on',
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setStatus({ ok: false, message: data?.error ?? 'Unknown error' })
        return
      }
      setStatus({ ok: true, message: 'Roles updated: ' + (data.roles?.join(', ') || 'none') })
    } catch {
      setStatus({ ok: false, message: 'Server error or response failed to parse' })
    }
  }

  return (
    <>
      {/* Header */}
      <div
        className="w-full bg-wdcc-blue/10 flex flex-row justify-between items-end pt-16 pb-0 px-5 sm:px-10 lg:px-20"
        style={{ boxShadow: 'inset 0 0 5px rgba(0, 0, 0, 0.2)' }}
      >
        <div className="flex flex-col justify-center items-start gap-y-3 py-8 w-full sm:w-2/3">
          <h1 className="text-wdcc-oshan uppercase font-extrabold tracking-tight !leading-none m-0 text-[clamp(1.75rem,5vw,4rem)]">
            Manage Roles
          </h1>
          <p className="font-mono text-wdcc-grey text-sm sm:text-base">
            Grant or revoke admin and exec roles for users by email address.
          </p>
        </div>
        <Image
          src="/webster.png"
          alt="Webster"
          width={200}
          height={200}
          className="drop-shadow-2xl translate-y-1/3 hidden sm:block shrink-0"
        />
      </div>

      <div className="mt-44 px-5 sm:px-10 lg:px-20 pb-20 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Add Role */}
        <RoleCard
          title="Add Role"
          accentColor="blue"
          status={addStatus}
          onSubmit={(fd) => handleSubmit(fd, 'POST', setAddStatus)}
          submitLabel="Add Role(s)"
        />

        {/* Remove Role */}
        <RoleCard
          title="Remove Role"
          accentColor="pink"
          status={removeStatus}
          onSubmit={(fd) => handleSubmit(fd, 'DELETE', setRemoveStatus)}
          submitLabel="Remove Role(s)"
        />
      </div>
    </>
  )
}

function RoleCard({
  title,
  accentColor,
  status,
  onSubmit,
  submitLabel,
}: {
  title: string
  accentColor: 'blue' | 'pink'
  status: Status
  onSubmit: (fd: FormData) => void
  submitLabel: string
}) {
  const isBlue = accentColor === 'blue'
  const checkboxAccent = isBlue ? 'accent-[#077CF1]' : 'accent-[#E333A3]'

  return (
    <div
      className="transition-all duration-300"
      style={{
        borderRadius: '24px',
        border: '3px solid transparent',
        background: BORDER_DEFAULT,
        transition: 'transform 0.25s ease, box-shadow 0.25s ease, background 0.3s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = BORDER_HOVER
        e.currentTarget.style.boxShadow =
          '0 12px 32px rgba(227,51,163,0.12), 0 4px 12px rgba(7,124,241,0.08)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = BORDER_DEFAULT
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <div className="flex flex-col px-7 pt-7 pb-6 gap-5">
        <div>
          <p className={`font-extrabold uppercase text-base`}>{title}</p>
          <div className="h-px mt-3" />
        </div>

        <form action={onSubmit} className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
              Email <span className="text-wdcc-kelvin">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              placeholder="user@example.com"
              className="font-mono text-sm text-wdcc-oshan bg-[#f8f8fc] border-[1.5px] border-wdcc-purple rounded-xl px-3.5 py-2.5 outline-none focus:border-wdcc-blue focus:bg-white focus:ring-2 focus:ring-wdcc-blue/10 transition-all placeholder:text-wdcc-grey-light"
            />
          </div>

          {/* Roles */}
          <div className="flex flex-col gap-2">
            <label className="font-mono text-[10px] uppercase tracking-widest text-wdcc-grey font-semibold">
              Roles
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="adminRole"
                  className={`w-4 h-4 rounded ${checkboxAccent}`}
                />
                <span className="font-mono text-sm text-wdcc-grey">Admin</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="execRole"
                  className={`w-4 h-4 rounded ${checkboxAccent}`}
                />
                <span className="font-mono text-sm text-wdcc-grey">Exec</span>
              </label>
            </div>
          </div>

          {/* Status */}
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

          <button
            type="submit"
            className={`flex items-center justify-center gap-2 font-mono text-sm font-semibold text-white bg-wdcc-oshan hover:bg-wdcc-oshan/80 rounded-xl px-6 py-2.5 transition-all duration-150 mt-1`}
          >
            <span>→</span>
            {submitLabel}
          </button>
        </form>
      </div>
    </div>
  )
}
