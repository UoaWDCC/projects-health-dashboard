import { db } from '@repo/db'
import { notFound } from 'next/navigation'
import EditProjectForm from './EditProjectForm'

export default async function ProjectEditPage(props: { params: Promise<{ slug: string }> }) {
  const params = await props.params

  const project = await db.project.findUnique({
    where: { slug: params.slug },
    include: {
      repositories: true,
      channels: true,
    },
  })

  if (!project) {
    return notFound()
  }

  return <EditProjectForm project={project} />
}
