import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MemberAvatar from './MemberAvatar'
import ViewAllMembersButton from './ViewAllMembersButton'
import type { TeamMemberStats } from '@/lib/project/weekly-stats'

const MAX_VISIBLE_MEMBERS = 6

/**
 * "The team" section on the project page. Desktop shows a strip of member
 * avatar cards with a link to the full team members page; mobile shows the
 * "View all members" button instead.
 */
export default function TeamSection({
  slug,
  members,
}: {
  slug: string
  members: TeamMemberStats[]
}) {
  const membersHref = `/project/${slug}/members`
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS)
  const overflowCount = members.length - visibleMembers.length

  return (
    <>
      {/* MOBILE */}
      <ViewAllMembersButton slug={slug} />

      {/* DESKTOP */}
      <section className="hidden lg:flex w-full flex-col gap-8">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-baseline gap-4 min-w-0">
            <h2 className="text-2xl lg:text-4xl font-extrabold whitespace-nowrap">The team</h2>
            <span className="font-mono text-base text-wdcc-grey-light truncate">
              {members.length} contributor{members.length !== 1 ? 's' : ''}
            </span>
          </div>

          <Link
            href={membersHref}
            className="flex items-center gap-3 rounded-full bg-wdcc-oshan px-6 py-3 text-white font-sans text-base font-semibold whitespace-nowrap shrink-0 transition-transform duration-200 hover:scale-[1.03]"
          >
            View all members
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>

        {members.length > 0 && (
          <div className="flex gap-4">
            {visibleMembers.map((member) => (
              <div
                key={member.id}
                className="flex-1 min-w-0 flex flex-col rounded-xl border border-[#E4E7F0] bg-white overflow-hidden"
              >
                <div className="flex justify-center items-center py-6 bg-[#F1F3F9]">
                  <MemberAvatar
                    name={member.name}
                    imageUrl={member.imageUrl}
                    size={64}
                    className="w-16 h-16"
                  />
                </div>
                <p className="font-mono text-xs text-wdcc-oshan text-center px-2 py-3 truncate">
                  {member.name}
                </p>
              </div>
            ))}

            {overflowCount > 0 && (
              <Link
                href={membersHref}
                className="flex-1 min-w-0 flex flex-col rounded-xl border border-[#E4E7F0] bg-white overflow-hidden transition-transform duration-200 hover:scale-[1.03]"
              >
                <div className="flex-1 flex justify-center items-center py-6 bg-wdcc-oshan">
                  <span className="font-sans text-2xl font-bold text-white">+{overflowCount}</span>
                </div>
                <p className="font-mono text-xs text-wdcc-blue text-center px-2 py-3 whitespace-nowrap">
                  View all ›
                </p>
              </Link>
            )}
          </div>
        )}
      </section>
    </>
  )
}
