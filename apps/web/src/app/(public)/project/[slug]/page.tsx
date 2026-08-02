import TeamHeader from '@/components/headers/TeamHeader'
import WeeklyMvp from '@/components/ui/WeeklyMvp'
import TeamSection from '@/components/ui/TeamSection'
import ViewAllMembersButton from '@/components/ui/ViewAllMembersButton'
import { getUserRoles } from '@/lib/auth'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getProjectMembers } from '@/lib/project/members'
import { getProjectWeeklyMvp } from '@/lib/project/weekly-stats'
import { notFound } from 'next/navigation'
import GraphViewToggle from '@/components/charts/GraphViewToggle'
import { Role } from '@repo/db'

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const [project, mvp, members, roles] = await Promise.all([
    getProjectHeaderData(slug),
    getProjectWeeklyMvp(slug).catch(() => null),
    getProjectMembers(slug).catch(() => []),
    getUserRoles(),
  ])

  if (!project) {
    notFound()
  }

  // Only execs can drill into a member's contribution breakdown.
  const isExec = roles.includes(Role.EXEC) || roles.includes(Role.ADMIN)

  const mvpName = mvp?.projectMember.displayName ?? mvp?.projectMember.person.displayName

  return (
    <>
      <TeamHeader project={project} />

      <div className="px-5 sm:px-10 lg:px-20 py-8 sm:py-12 lg:py-20 w-full flex flex-col items-center gap-8 sm:gap-12 lg:gap-20">
        {mvp && mvpName && (
          <div className="w-full flex flex-col items-center gap-4 lg:gap-10">
            <h2 className="text-2xl lg:text-4xl font-extrabold self-start">Weekly MVP</h2>

            <WeeklyMvp
              name={mvpName}
              avatarUrl={mvp.projectMember.person.imageUrl ?? undefined}
              linesCommitted={mvp.linesAdded}
            />
          </div>
        )}

        <TeamSection slug={slug} members={members} isExec={isExec} />
        <ViewAllMembersButton slug={slug} members={members} />

        <GraphViewToggle slug={slug} />
      </div>
    </>
  )
}
