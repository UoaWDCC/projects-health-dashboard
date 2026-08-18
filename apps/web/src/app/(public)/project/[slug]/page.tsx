import TeamHeader from '@/components/headers/TeamHeader'
import WeeklyMvp from '@/components/ui/WeeklyMvp'
import TeamSection from '@/components/ui/TeamSection'
import ViewAllMembersButton from '@/components/ui/ViewAllMembersButton'
import ConnectedSources from '@/components/ui/ConnectedSources'
import { getUserRoles } from '@/lib/auth'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getProjectMembers } from '@/lib/project/members'
import { getProjectWeeklyMvp } from '@/lib/project/weekly-stats'
import { updateRepository, updateChannel, deleteProject } from '@/actions/project-page'
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
  const isAdmin = roles.includes(Role.ADMIN)

  const mvpName = mvp?.projectMember.displayName ?? mvp?.projectMember.person.displayName

  return (
    <>
      <TeamHeader
        project={project}
        isAdmin={isAdmin}
        onDeleteProject={deleteProject.bind(null, project.id)}
      />

      {isAdmin && (
        <div className="px-5 sm:px-10 lg:px-20 mt-6 sm:mt-12 lg:mt-20">
          <ConnectedSources
            repositories={project.repositories}
            channels={project.channels}
            onSaveRepository={updateRepository}
            onSaveChannel={updateChannel}
          />
        </div>
      )}

      <div className="px-5 sm:px-10 lg:px-20 pt-8 sm:pt-12 lg:pt-20 pb-[120px] lg:pb-20 w-full flex flex-col items-center gap-8 sm:gap-12 lg:gap-20">
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
