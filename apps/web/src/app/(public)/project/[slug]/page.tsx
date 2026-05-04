import TeamHeader from '@/components/headers/TeamHeader'
import { getProjectHeaderData } from '@/lib/project/projects'
import { notFound } from 'next/navigation'

export default async function ProjectPage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug
  const project = await getProjectHeaderData(slug)

  if (!project) {
    notFound()
  }

  return <TeamHeader project={project} />
}
