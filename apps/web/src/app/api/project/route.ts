import { db } from '@repo/db'

/**
 * TODO: Add authentication and authorization to ensure only admins can access these routes
 * Add error validation for checking if the project name is unique and if the Discord link is valid.
 */

function validateGitHubLink(link: string) {
  // expected GitHub Link - https://github.com/owner/reponame
  const regex = /^https:\/\/github\.com\/[^\/]+\/[^\/]+$/
  return regex.test(link)
}

function parseDate(input: string): Date | null {
  // expected input format - YYYY-MM
  const [year, month] = input.split('-').map(Number)
  if (!year || !month || month < 1 || month > 12) {
    return null
  }
  return new Date(Date.UTC(year, month - 1))
}

// API route for handling project creation
export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const projectName = String(formData.get('projectName') ?? '').trim()
    const githubLink = String(formData.get('githubLink') ?? '').trim()
    const discordSnowflakeId = String(formData.get('discordSnowflakeId') ?? '').trim()
    const projectDescription = String(formData.get('projectDescription') ?? '').trim()
    const projectStartDate = String(formData.get('projectStartDate') ?? '').trim()

    if (!projectName || !githubLink || !discordSnowflakeId) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!validateGitHubLink(githubLink)) {
      return Response.json({ error: 'Invalid GitHub Repository Link' }, { status: 400 })
    }

    const newProject = await db.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
        data: {
          name: projectName,
          slug: projectName.toLowerCase().replace(/\s+/g, '-'),
          description: projectDescription || null,
          startedAt: parseDate(projectStartDate),
        },
      })

      const existingRepo = await tx.gitHubRepository.findFirst({
        where: { owner: githubLink.split('/')[3], name: githubLink.split('/')[4] },
      })
      if (!existingRepo) {
        await tx.gitHubRepository.create({
          data: {
            projectId: createdProject.id,
            owner: githubLink.split('/')[3],
            name: githubLink.split('/')[4],
            // placeholder value
            installationId: '0',
          },
        })
      } else {
        throw new Error(
          'GitHub Repository with this owner and name has already been linked to another project'
        )
      }

      const existingChannel = await tx.discordChannel.findFirst({
        where: { externalId: discordSnowflakeId },
      })
      if (!existingChannel) {
        await tx.discordChannel.create({
          data: {
            projectId: createdProject.id,
            externalId: discordSnowflakeId,
            // placeholder value
            name: projectName + ' Discord Channel',
          },
        })
      } else {
        throw new Error(
          'Discord Channel with this Snowflake ID has already been linked to another project'
        )
      }

      return tx.project.findUnique({
        where: { id: createdProject.id },
        include: { repositories: true, channels: true },
      })
    })

    return Response.json(newProject, { status: 201 })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Failed to create project' },
      { status: 500 }
    )
  }
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
    return Response.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}
