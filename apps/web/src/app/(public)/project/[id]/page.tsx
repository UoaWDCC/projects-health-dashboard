import TeamHeader from '@/components/headers/TeamHeader'
import { getProjectHeaderData } from '@/lib/project/projects'
import { notFound } from 'next/navigation'

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id
  const project = await getProjectHeaderData(id)

  if (!project) {
    notFound()
  }

  return <TeamHeader project={project} />
}
