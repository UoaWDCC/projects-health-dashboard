import { db } from '@repo/db'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const owner = searchParams.get('owner')
  const name = searchParams.get('name')

  if (!owner || !name) {
    return Response.json({ error: 'Missing owner or name parameter' }, { status: 400 })
  }

  try {
    const repo = await db.gitHubRepository.findFirst({
      where: { owner, name },
      include: {
        _count: {
          select: { commits: true, prs: true },
        },
      },
    })

    const hasData = repo ? repo._count.commits > 0 || repo._count.prs > 0 : false

    return Response.json({ hasData }, { status: 200 })
  } catch (error) {
    console.error('Error checking repository data:', error)
    return Response.json({ error: 'Failed to check repository' }, { status: 500 })
  }
}
