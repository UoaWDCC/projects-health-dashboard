import Link from 'next/link'
import { notFound } from 'next/navigation'
import MemberCard from '@/components/ui/MemberCard'
import LastUpdatedTime from '@/components/headers/LastUpdatedTime'
import { getProjectHeaderData } from '@/lib/project/projects'
import { getProjectTeamMembers } from '@/lib/project/weekly-stats'
import { db, SyncJobStatus, SyncJobType } from '@repo/db'

async function getLastUpdated(): Promise<Date> {
  try {
    const syncJob = await db.syncJob.findFirst({
      where: { type: SyncJobType.GITHUB, status: SyncJobStatus.SUCCESS },
      orderBy: { finishedAt: 'desc' },
      select: { finishedAt: true },
    })
    return syncJob?.finishedAt ?? new Date()
  } catch {
    return new Date()
  }
}

export default async function TeamMembersPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const [project, members, lastUpdated] = await Promise.all([
    getProjectHeaderData(slug),
    getProjectTeamMembers(slug).catch(() => []),
    getLastUpdated(),
  ])

  if (!project) {
    notFound()
  }

  return (
    <>
      {/* PAGE HEADER */}
      <div className="bg-wdcc-blue-light w-full px-5 sm:px-10 lg:px-20 pt-8 sm:pt-12 lg:pt-16 pb-8 lg:pb-14">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
          <div className="min-w-0">
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
              <span className="text-wdcc-oshan font-medium">Team Members</span>
            </nav>

            <h1 className="mt-3 lg:mt-5 font-extrabold tracking-tight !leading-none text-[clamp(2rem,5vw,4rem)]">
              Team Members
            </h1>

            <p className="mt-3 lg:mt-5 font-mono text-sm lg:text-lg text-wdcc-grey">
              {project.name} · {members.length} contributor{members.length !== 1 ? 's' : ''} ·
              ranked by lines committed
            </p>
          </div>

          {/* Updated pill — desktop only, per Figma */}
          <div className="hidden lg:flex items-center gap-3 rounded-full bg-white px-5 py-2.5 shrink-0 w-fit">
            <span className="w-3 h-3 rounded-full bg-green-600 shrink-0" />
            <span className="font-mono text-base text-wdcc-grey whitespace-nowrap">
              Updated <LastUpdatedTime isoDate={lastUpdated.toISOString()} />
            </span>
          </div>
        </div>
      </div>

      {/* MEMBER GRID */}
      <div className="px-5 sm:px-10 lg:px-20 py-8 lg:py-14">
        {members.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4 lg:gap-8">
            {members.map((member, index) => (
              <MemberCard key={member.id} member={member} index={index} />
            ))}
          </div>
        ) : (
          <p className="py-16 text-center font-mono text-wdcc-grey">
            No team members yet. Members appear here once they are added to the project.
          </p>
        )}
      </div>
    </>
  )
}
