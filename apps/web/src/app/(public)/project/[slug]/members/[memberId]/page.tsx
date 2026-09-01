import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import MemberAvatar from '@/components/ui/MemberAvatar'
import MemberContributionChart from '@/components/charts/MemberContributionChart'
import { getUserRoles } from '@/lib/auth'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getMemberContributionBreakdown } from '@/lib/project/member-contribution'
import { Role } from '@repo/db'

function formatWeek(weekStart: Date): string {
  return weekStart.toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

export default async function MemberContributionPage({
  params,
}: {
  params: Promise<{ slug: string; memberId: string }>
}) {
  const { slug, memberId } = await params

  // Exec-only page — everyone else goes back to the team members page.
  // ADMIN is treated as a superset of EXEC, matching the (exec) route group.
  const roles = await getUserRoles()
  const isAdmin = roles.includes(Role.ADMIN)
  if (!roles.includes(Role.EXEC) && !isAdmin) {
    redirect(`/project/${slug}/members`)
  }

  const [project, breakdown] = await Promise.all([
    getProjectHeaderData(slug),
    getMemberContributionBreakdown(slug, memberId),
  ])

  if (!project || !breakdown) {
    notFound()
  }

  const { member, latestWeekStart, ranges } = breakdown

  return (
    <>
      {/* PAGE HEADER */}
      <div className="bg-wdcc-blue-light w-full px-5 sm:px-10 lg:px-20 pt-8 sm:pt-12 lg:pt-16 pb-8 lg:pb-14">
        <nav
          aria-label="Breadcrumb"
          className="font-mono text-xs lg:text-sm uppercase tracking-[0.2em] text-wdcc-grey"
        >
          <Link href="/" className="hover:text-wdcc-oshan transition-colors">
            Projects
          </Link>
          <span className="mx-2">›</span>
          <Link href={`/project/${slug}`} className="hover:text-wdcc-oshan transition-colors">
            {project.name}
          </Link>
          <span className="mx-2">›</span>
          <Link
            href={`/project/${slug}/members`}
            className="hover:text-wdcc-oshan transition-colors"
          >
            Team Members
          </Link>
          <span className="mx-2">›</span>
          <span className="text-wdcc-oshan font-medium">{member.name}</span>
        </nav>

        <div className="mt-5 flex items-center gap-4">
          <MemberAvatar
            name={member.name}
            imageUrl={member.imageUrl}
            color="#077CF1"
            className="w-14 h-14 lg:w-20 lg:h-20 shrink-0"
          />
          <div className="min-w-0">
            <div className="flex items-end gap-3">
              <h1 className="font-extrabold tracking-tight !leading-none text-[clamp(1.75rem,4vw,3rem)]">
                {member.name}
              </h1>
              {isAdmin && (
                <Link
                  href={`/projects/${slug}/members/${memberId}/edit`}
                  className="shrink-0 rounded-full bg-wdcc-oshan px-4 py-1.5 text-sm text-white hover:bg-gray-300 transition-colors"
                >
                  Edit Details
                </Link>
              )}
            </div>
            <p className="mt-2 font-mono text-sm lg:text-base text-wdcc-grey truncate">
              {member.username ? `@${member.username} · ` : ''}
              {project.name}
            </p>
          </div>
        </div>
      </div>

      {/* CONTRIBUTION BREAKDOWN */}
      <div className="px-5 sm:px-10 lg:px-20 py-8 lg:py-14">
        <h2 className="text-2xl lg:text-3xl font-extrabold">Contribution breakdown</h2>
        <p className="mt-2 font-mono text-sm text-wdcc-grey">
          {latestWeekStart
            ? `Current week is the week starting ${formatWeek(latestWeekStart)} — the most recent week collected for ${project.name}.`
            : `No contribution data has been collected for ${project.name} yet.`}
        </p>

        <div className="mt-6">
          <MemberContributionChart ranges={ranges} />
        </div>

        <Link
          href={`/project/${slug}/members`}
          className="mt-8 inline-block font-mono text-sm text-wdcc-blue hover:underline"
        >
          ← Back to team members
        </Link>
      </div>
    </>
  )
}
