import { labelClass } from '@/lib/admin/layout'

export type MemberRoles = {
  isDeveloper: boolean
  isDesigner: boolean
}

const ROLE_OPTIONS = [
  { key: 'isDeveloper', label: 'Developer' },
  { key: 'isDesigner', label: 'Designer' },
] as const

/**
 * Checkboxes for marking a project member as a developer, a designer, or both.
 * Leaving both unchecked means no role is set, and no badge is shown for the member.
 * Pass `disabledHint` to show the current roles read-only, with the hint explaining why.
 */
export default function MemberRoleFields({
  value,
  onChange,
  disabledHint,
}: {
  value: MemberRoles
  onChange: (value: MemberRoles) => void
  disabledHint?: string
}) {
  const disabled = disabledHint !== undefined

  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Role</span>
      <div className="flex flex-wrap gap-5">
        {ROLE_OPTIONS.map((option) => (
          <label
            key={option.key}
            className={`flex items-center gap-2 ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
          >
            <input
              type="checkbox"
              checked={value[option.key]}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, [option.key]: e.target.checked })}
              className="accent-[#077CF1]"
            />
            <span className="font-mono text-sm font-semibold text-wdcc-oshan">{option.label}</span>
          </label>
        ))}
      </div>
      <p className="font-mono text-[11px] text-wdcc-grey-light">
        {disabledHint ?? 'Select one or both. Leave both unchecked if no role applies.'}
      </p>
    </div>
  )
}
