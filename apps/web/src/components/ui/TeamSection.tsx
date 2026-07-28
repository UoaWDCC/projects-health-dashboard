import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MemberAvatar from './MemberAvatar'
import { AVATAR_COLORS } from '@/lib/project/members'
import type { ProjectMemberSummary } from '@/lib/project/members'

const MAX_VISIBLE_MEMBERS = 6

/**
 * Desktop-only team member cards with an overflow "+N" card when there are more members than max.
 * The header action and the overflow card both link to the project's team members page.
 */
export default function TeamSection({
  slug,
  members,
}: {
  slug: string
  members: ProjectMemberSummary[]
}) {
  if (members.length === 0) {
    return null
  }

  const membersHref = `/project/${slug}/members`
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const overflowCount = members.length - visibleMembers.length

  return (
    <section className="hidden lg:block w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h2 className="text-3xl font-extrabold">The team</h2>
          <p className="font-mono text-lg text-wdcc-grey-light">
            {members.length} contributor{members.length !== 1 && 's'}
          </p>
        </div>

        <Link
          href={membersHref}
          className="flex items-center gap-3 rounded-full bg-wdcc-oshan px-7 py-4 font-sans text-xl font-medium text-white transition-transform duration-200 hover:scale-[1.03]"
        >
          View all members
          <ArrowRight className="w-5 h-5" />
        </Link>
      </div>

      <div className="mt-8 flex gap-4">
        {visibleMembers.map((member, index) => (
          <div
            key={member.id}
            className="flex-1 min-w-0 overflow-hidden rounded-2xl border border-[#E9EBF4] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.1)]"
          >
            <div className="flex h-[140px] items-end justify-center bg-[#E9EBF4] xl:h-[170px]">
              <MemberAvatar
                name={member.name}
                imageUrl={member.imageUrl}
                color={AVATAR_COLORS[index % AVATAR_COLORS.length]}
                className="w-36 h-36"
              />
            </div>
            <p className="truncate px-2 py-3 text-center font-mono">{member.name}</p>
          </div>
        ))}

        {overflowCount > 0 && (
          <Link
            href={membersHref}
            aria-label={`View all ${members.length} members`}
            className="flex flex-1 min-w-0 flex-col overflow-hidden rounded-2xl border border-[#E9EBF4] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-transform duration-200 hover:scale-[1.03]"
          >
            <span className="flex w-full flex-1 items-center justify-center bg-wdcc-oshan text-3xl font-extrabold text-white xl:text-4xl">
              +{overflowCount}
            </span>
            <span className="w-full py-3 text-center font-mono text-wdcc-blue">View all ›</span>
          </Link>
        )}
      </div>
    </section>
  )
}
