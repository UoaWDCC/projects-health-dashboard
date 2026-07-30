import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import MemberAvatar from './MemberAvatar'
import { AVATAR_COLORS } from '@/lib/project/members'
import type { ProjectMemberSummary } from '@/lib/project/members'

const MAX_PREVIEW_AVATARS = 3

/**
 * Mobile-only link to the project's team members page, showing a preview of the
 * first few members' avatars.
 */
export default function ViewAllMembersButton({
  slug,
  members,
}: {
  slug: string
  members: ProjectMemberSummary[]
}) {
  const previewMembers = members.slice(0, MAX_PREVIEW_AVATARS)

  return (
    <Link
      href={`/project/${slug}/members`}
      aria-label="View all members"
      className="lg:hidden w-full flex items-center gap-4 rounded-2xl bg-wdcc-oshan px-6 py-5 text-white"
    >
      {previewMembers.length > 0 && (
        <div className="flex items-center -space-x-2 shrink-0">
          {previewMembers.map((member, index) => (
            <MemberAvatar
              key={member.id}
              name={member.name}
              imageUrl={member.imageUrl}
              color={AVATAR_COLORS[index % AVATAR_COLORS.length]}
              fallback="dot"
              className="w-6 h-6 rounded-full border-2 border-wdcc-oshan"
            />
          ))}
        </div>
      )}
      <span className="font-sans text-sm font-semibold">View all members</span>
      <ArrowRight className="ml-auto w-5 h-5 shrink-0" />
    </Link>
  )
}
