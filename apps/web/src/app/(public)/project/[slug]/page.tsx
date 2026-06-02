import TeamHeader from '@/components/headers/TeamHeader'
import WeeklyMvp from '@/components/ui/WeeklyMvp'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getProjectWeeklyMvp } from '@/lib/project/weekly-stats'
import { notFound } from 'next/navigation'
import GraphViewToggle from '@/components/charts/GraphViewToggle'

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

      <div className="px-5 sm:px-10 lg:px-20 py-20 w-full flex flex-col items-center gap-20">
        {mvp && mvpName && (
          <div className="w-full flex flex-col items-center gap-10">
            <h2 className="text-4xl font-extrabold self-start">Weekly MVP</h2>

            <WeeklyMvp
              name={mvpName}
              avatarUrl={mvp.projectMember.person.imageUrl ?? undefined}
              linesCommitted={mvp.linesAdded}
            />
          </div>
        )}

        <GraphViewToggle slug={slug} />
      </div>
    </>
  )
}
