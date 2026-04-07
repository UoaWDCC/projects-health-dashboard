import { db } from '@repo/db'

/**
 * TODO: Add authentication and authorization to ensure only admins can access these routes
 * Add error validation for checking if the project name is unique, if the GitHub link is valid, and if the Discord link is valid.
 */

// API route for handling project creation
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLink = String(formData.get('githubLink') ?? '').trim()
    const discordLink = String(formData.get('discordLink') ?? '').trim()

    if (!projectName || !githubLink || !discordLink) {
      return new Response('Missing required fields', { status: 400 })
    }

    const createdProject = await db.project.create({
      data: {
        name: projectName,
        slug: projectName.toLowerCase().replace(/\s+/g, '-'),
        isActive: true,
        createdAt: new Date(),
      },
    })

    await db.gitHubRepository.create({
      data: {
        projectId: createdProject.id,
        owner: githubLink.split('/')[3],
        name: githubLink.split('/')[4],
        // Need to change to actual installation ID
        installationId: '0',
      },
    })

    await db.discordChannel.create({
      data: {
        projectId: createdProject.id,
        externalId: discordLink,
        // Need to change to actual channel name
        name: projectName + ' Discord Channel',
      },
    })
  } catch (error) {
    console.error('Error creating project:', error)
    return new Response('Failed to create project', { status: 500 })
  }

  return new Response('Project created successfully', { status: 200 })
}

// API route for fetching all active projects
export async function GET() {
  try {
    const projects = await db.project.findMany({
      where: { isActive: true },
      include: {
        repositories: true,
        channels: true,
      },
    })
    return Response.json(projects, { status: 200 })
  } catch (error) {
    console.error('Error fetching projects:', error)
    return new Response('Failed to fetch projects', { status: 500 })
  }
}
