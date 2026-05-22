import TeamHeader from '@/components/headers/TeamHeader'
import ProjectGraphs from './ProjectGraphs'
import WeeklyMvp from '@/components/ui/WeeklyMvp'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getProjectWeeklyMvp } from '@/lib/project/weekly-stats'
import { notFound } from 'next/navigation'

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const [project, mvp] = await Promise.all([
    getProjectHeaderData(slug),
    getProjectWeeklyMvp(slug).catch(() => null),
  ])

  if (!project) {
    notFound()
  }

  const mvpName = mvp?.projectMember.displayName ?? mvp?.projectMember.person.displayName

  return (
    <>
      <TeamHeader project={project} />
      {mvp && mvpName && (
        <div className="px-6 md:px-12 py-6 w-full flex flex-col items-center gap-4">
          <h2 className="text-2xl font-bold self-start">Weekly MVP</h2>
          <WeeklyMvp
            name={mvpName}
            avatarUrl={mvp.projectMember.person.imageUrl ?? undefined}
            linesCommitted={mvp.linesAdded}
          />
        </div>
      )}
      <ProjectGraphs slug={slug} />
    </>
  )
}
