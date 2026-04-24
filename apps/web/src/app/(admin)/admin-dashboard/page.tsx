/**
 * Admin dashboard — only should be accessible to administrators.
 * Currently should allow administrators to create projects and view their current projects.
 *
 * TODO: Implement the design
 * Make it so that it is only accessible to the admin who owns the projects once authentication is implemented.
 * Add functionality to delete projects and edit projects.
 */

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  startedAt: string | null
  createdAt: string
  repositories: {
    id: string
    owner: string
    name: string
    installationId: string
  }[]
  channels: {
    id: string
    externalId: string
    name: string
  }[]
}

const fetchProjects = async (): Promise<Project[]> => {
  try {
    const response = await fetch('/api/project')
    if (!response.ok) {
      throw new Error('Failed to fetch projects')
    }
    const projects = await response.json()
    return projects as Project[]
  } catch (error) {
    console.error('Error fetching projects:', error)
    return []
  }
}

export default function AdminDashboardPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      const data = await fetchProjects()
      setProjects(data)
    }

    load()
  }, [])

  return (
    <main>
      <h1>WDCC Projects Health Dashboard - Admin View</h1>
      <p>Projects:</p>
      <ul>
        {projects.map((project) => (
          <li key={project.id}>
            <strong style={{ textDecoration: 'underline' }}>
              <Link href={`/projects/${project.id}`}>{project.name}</Link>
            </strong>
            <p>{project.description}</p>
            <p>Slug: {project.slug}</p>
            <p>Started at: {project.startedAt}</p>
            <p>Created at: {project.createdAt}</p>
            <div style={{ marginTop: 8 }}>
              <h4>Repositories:</h4>
              <ul>
                {project.repositories.map((repo) => (
                  <li key={repo.id}>
                    <div>
                      <strong>
                        {repo.owner}/{repo.name}
                      </strong>
                    </div>
                    <div>Installation ID: {repo.installationId}</div>
                  </li>
                ))}
              </ul>
            </div>
            <div style={{ marginTop: 8 }}>
              <h4>Discord Channels:</h4>
              <ul>
                {project.channels?.map((ch) => (
                  <li key={ch.id}>
                    <div>
                      <strong>{ch.name}</strong>
                    </div>
                    <div>External ID: {ch.externalId}</div>
                    <div>Channel Name: {ch.name}</div>
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      <button onClick={() => router.push('/projects/new')}>Create New Project (Button)</button>
    </main>
  )
}
