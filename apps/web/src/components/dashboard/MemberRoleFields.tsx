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
 */
export default function MemberRoleFields({
  value,
  onChange,
}: {
  value: MemberRoles
  onChange: (value: MemberRoles) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={labelClass}>Role</span>
      <div className="flex flex-wrap gap-5">
        {ROLE_OPTIONS.map((option) => (
          <label key={option.key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value[option.key]}
              onChange={(e) => onChange({ ...value, [option.key]: e.target.checked })}
              className="accent-[#077CF1]"
            />
            <span className="font-mono text-sm font-semibold text-wdcc-oshan">{option.label}</span>
          </label>
        ))}
      </div>
      <p className="font-mono text-[11px] text-wdcc-grey-light">
        Select one or both. Leave both unchecked if no role applies.
      </p>
    </div>
  )
}
