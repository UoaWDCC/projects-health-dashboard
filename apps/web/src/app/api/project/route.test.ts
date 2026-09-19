import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { revalidateTag } from 'next/cache'
import { db } from '@repo/db'
import { getInstallationOctokit } from '@repo/github'
import { hasRole } from '@/lib/auth'
import { uploadImage } from '@/lib/storage'
import { MAX_IMAGE_BYTES } from '@/lib/schemas/admin'
import {
  GET,
  POST,
  parseGitHubRepo,
  validateGitHubExists,
  validateGitHubLinkFormat,
  validateSnowflakeExists,
} from './route'

vi.mock('@/lib/auth', () => ({ hasRole: vi.fn() }))
vi.mock('@/lib/storage', () => ({ uploadImage: vi.fn() }))
vi.mock('@repo/github', () => ({ getInstallationOctokit: vi.fn() }))

const REPO_URL = 'https://github.com/acme/widgets'
const CHANNEL_ID = '123456789012345678'
const CHANNEL_ID_2 = '223456789012345678'
// 18-digit snowflake unique per index (i < 100)
const snowflake = (i: number) => `1000000000000000${String(i).padStart(2, '0')}`
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 1024 * 1024

interface PostFields {
  projectName?: string
  projectDescription?: string
  projectStartDate?: string
  githubLinks?: string[]
  discordSnowflakeIds?: string[]
  discordChannelNames?: string[]
  image?: File
}

// Builds a POST request with valid defaults; pass overrides to break one field at a time.
function makePost(fields: PostFields = {}, headers: Record<string, string> = {}) {
  const {
    projectName = 'My Project',
    projectDescription = 'A description',
    projectStartDate = '2024-03',
    githubLinks = [REPO_URL],
    discordSnowflakeIds = [CHANNEL_ID],
    discordChannelNames = ['general'],
    image,
  } = fields

  const form = new FormData()
  form.set('projectName', projectName)
  form.set('projectDescription', projectDescription)
  form.set('projectStartDate', projectStartDate)
  githubLinks.forEach((l) => form.append('githubLinks', l))
  discordSnowflakeIds.forEach((id) => form.append('discordSnowflakeIds', id))
  discordChannelNames.forEach((n) => form.append('discordChannelNames', n))
  if (image) form.set('image', image)

  return new Request('http://localhost/api/project', { method: 'POST', body: form, headers })
}

const mocked = {
  hasRole: hasRole as Mock,
  getInstallationOctokit: getInstallationOctokit as Mock,
  uploadImage: uploadImage as Mock,
  transaction: db.$transaction as unknown as Mock,
  projectFindUnique: db.project.findUnique as Mock,
  projectFindMany: db.project.findMany as Mock,
  repoFindFirst: db.gitHubRepository.findFirst as Mock,
  channelFindUnique: db.discordChannel.findUnique as Mock,
}

describe('/api/project', () => {
  const octokitRequest = vi.fn()
  const txProjectCreate = vi.fn()
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('GITHUB_APP_INSTALLATION_ID', 'install-1')
    vi.stubEnv('DISCORD_BOT_TOKEN', 'bot-token')
    vi.stubGlobal('fetch', fetchMock)

    mocked.hasRole.mockResolvedValue(true)
    mocked.getInstallationOctokit.mockResolvedValue({ request: octokitRequest })
    octokitRequest.mockResolvedValue({})
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    mocked.projectFindUnique.mockResolvedValue(null)
    mocked.repoFindFirst.mockResolvedValue(null)
    mocked.channelFindUnique.mockResolvedValue(null)
    mocked.uploadImage.mockResolvedValue('https://cdn.example.com/my-project/image')

    txProjectCreate.mockImplementation(async ({ data }) => ({ id: 'proj-1', ...data }))
    mocked.transaction.mockImplementation(async (fn) =>
      fn({ project: { create: txProjectCreate } })
    )

    return () => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  describe('POST', () => {
    describe('guards', () => {
      it('returns 403 for non-admins without touching the request body or DB', async () => {
        mocked.hasRole.mockResolvedValue(false)

        const res = await POST(makePost())

        expect(res.status).toBe(403)
        expect(mocked.hasRole).toHaveBeenCalledWith('ADMIN')
        expect(mocked.projectFindUnique).not.toHaveBeenCalled()
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('returns 413 when content-length exceeds the limit', async () => {
        const res = await POST(makePost({}, { 'content-length': String(MAX_REQUEST_BYTES + 1) }))

        expect(res.status).toBe(413)
        expect((await res.json()).error).toMatch(/too large/i)
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('accepts a content-length exactly at the limit', async () => {
        const res = await POST(makePost({}, { 'content-length': String(MAX_REQUEST_BYTES) }))

        expect(res.status).toBe(201)
      })

      it('returns 500 when GITHUB_APP_INSTALLATION_ID is missing', async () => {
        vi.stubEnv('GITHUB_APP_INSTALLATION_ID', '')

        const res = await POST(makePost())

        expect(res.status).toBe(500)
        expect((await res.json()).error).toMatch(/Installation ID/)
        expect(mocked.projectFindUnique).not.toHaveBeenCalled()
      })
    })

    describe('400 validation', () => {
      it('returns 400 when channel ID and channel name counts differ', async () => {
        const res = await POST(
          makePost({
            discordSnowflakeIds: [CHANNEL_ID, CHANNEL_ID_2],
            discordChannelNames: ['general'],
          })
        )

        expect(res.status).toBe(400)
        expect((await res.json()).error).toBe('Missing required fields')
      })

      it('returns 400 when more than 20 repos are linked', async () => {
        const githubLinks = Array.from(
          { length: 21 },
          (_, i) => `https://github.com/acme/repo-${i}`
        )

        const res = await POST(makePost({ githubLinks }))

        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/no more than 20/)
        expect(octokitRequest).not.toHaveBeenCalled()
      })

      it('returns 400 when more than 20 channels are linked', async () => {
        const ids = Array.from({ length: 21 }, (_, i) => snowflake(i))
        const names = ids.map((_, i) => `channel-${i}`)

        const res = await POST(makePost({ discordSnowflakeIds: ids, discordChannelNames: names }))

        expect(res.status).toBe(400)
        expect((await res.json()).error).toMatch(/no more than 20/)
        expect(fetchMock).not.toHaveBeenCalled()
      })

      it('allows exactly 20 repos and 20 channels through the count check', async () => {
        const githubLinks = Array.from(
          { length: 20 },
          (_, i) => `https://github.com/acme/repo-${i}`
        )
        const ids = Array.from({ length: 20 }, (_, i) => snowflake(i))
        const names = ids.map((_, i) => `channel-${i}`)

        const res = await POST(
          makePost({ githubLinks, discordSnowflakeIds: ids, discordChannelNames: names })
        )

        expect(res.status).toBe(201)
      })

      it.each([
        ['empty project name', { projectName: '   ' }, 'Project name is required'],
        ['bad start date format', { projectStartDate: '03/2024' }, 'Must be in YYYY-MM format'],
        [
          'malformed GitHub URL',
          { githubLinks: ['http://github.com/acme/widgets'] },
          'Must be a valid GitHub repo URL (https://github.com/owner/repo)',
        ],
        ['no GitHub repos', { githubLinks: [] }, 'At least one repository is required'],
        [
          'non-numeric snowflake',
          { discordSnowflakeIds: ['not-a-snowflake'] },
          'Must be a 17-19 digit snowflake ID',
        ],
        [
          'no Discord channels',
          { discordSnowflakeIds: [], discordChannelNames: [] },
          'At least one Discord channel is required',
        ],
      ] as [string, PostFields, string][])(
        'returns 400 with the schema message for %s',
        async (_label, fields, message) => {
          const res = await POST(makePost(fields))

          expect(res.status).toBe(400)
          expect((await res.json()).error).toBe(message)
          expect(mocked.projectFindUnique).not.toHaveBeenCalled()
        }
      )
    })

    describe('deduplication', () => {
      it('removes duplicate GitHub links (validated and stored once)', async () => {
        const res = await POST(makePost({ githubLinks: [REPO_URL, REPO_URL] }))

        expect(res.status).toBe(201)
        expect(octokitRequest).toHaveBeenCalledTimes(1)
        expect(mocked.repoFindFirst).toHaveBeenCalledTimes(1)
        const { data } = txProjectCreate.mock.calls[0]![0]
        expect(data.repositories.create).toEqual([
          { owner: 'acme', name: 'widgets', installationId: 'install-1' },
        ])
      })

      it('removes duplicate channel IDs and keeps the first name', async () => {
        const res = await POST(
          makePost({
            discordSnowflakeIds: [CHANNEL_ID, CHANNEL_ID, CHANNEL_ID_2],
            discordChannelNames: ['first-name', 'second-name', 'other'],
          })
        )

        expect(res.status).toBe(201)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        const { data } = txProjectCreate.mock.calls[0]![0]
        expect(data.channels.create).toEqual([
          { externalId: CHANNEL_ID, name: 'first-name' },
          { externalId: CHANNEL_ID_2, name: 'other' },
        ])
      })
    })

    describe('409 conflicts', () => {
      it('returns 409 when the slug already exists', async () => {
        mocked.projectFindUnique.mockResolvedValue({ id: 'existing' })

        const res = await POST(makePost({ projectName: 'My Project' }))

        expect(res.status).toBe(409)
        expect(mocked.projectFindUnique).toHaveBeenCalledWith({ where: { slug: 'my-project' } })
        expect(octokitRequest).not.toHaveBeenCalled()
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('returns 409 when a repo is already linked to an active project', async () => {
        mocked.repoFindFirst.mockResolvedValue({ id: 'repo-1' })

        const res = await POST(makePost())

        expect(res.status).toBe(409)
        expect((await res.json()).error).toContain(REPO_URL)
        expect(mocked.repoFindFirst).toHaveBeenCalledWith({
          where: { owner: 'acme', name: 'widgets', isActive: true },
        })
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('returns 409 when a channel is already linked to an active project', async () => {
        mocked.channelFindUnique.mockResolvedValue({ id: 'ch-1', isActive: true })

        const res = await POST(makePost())

        expect(res.status).toBe(409)
        expect((await res.json()).error).toContain(CHANNEL_ID)
        expect(mocked.channelFindUnique).toHaveBeenCalledWith({ where: { externalId: CHANNEL_ID } })
        expect(mocked.transaction).not.toHaveBeenCalled()
      })
    })

    describe('GitHub validation errors', () => {
      it.each([
        [404, 404, /not found/],
        [403, 403, /not accessible/],
        [401, 401, /Invalid GitHub token/],
        [500, 500, /Failed to validate GitHub repository/],
      ])('maps a GitHub %i error to a %i response', async (githubStatus, expected, message) => {
        octokitRequest.mockRejectedValue({ status: githubStatus })

        const res = await POST(makePost())

        expect(res.status).toBe(expected)
        expect((await res.json()).error).toMatch(message)
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('maps an error without a status to 500', async () => {
        octokitRequest.mockRejectedValue(new Error('socket hang up'))

        const res = await POST(makePost())

        expect(res.status).toBe(500)
        expect((await res.json()).error).toMatch(/Failed to validate GitHub repository/)
      })

      it('calls GET /repos/{owner}/{repo} with the parsed repo', async () => {
        await POST(makePost())

        expect(mocked.getInstallationOctokit).toHaveBeenCalledWith('install-1')
        expect(octokitRequest).toHaveBeenCalledWith('GET /repos/{owner}/{repo}', {
          owner: 'acme',
          repo: 'widgets',
        })
      })
    })

    describe('Discord validation errors', () => {
      it.each([
        [404, 404, /not found/],
        [403, 403, /forbidden/],
        [401, 401, /Invalid Discord token/],
        [500, 500, /Failed to validate Discord channel/],
      ])(
        'maps a Discord %i response to a %i response',
        async (discordStatus, expected, message) => {
          fetchMock.mockResolvedValue({ ok: false, status: discordStatus })

          const res = await POST(makePost())

          expect(res.status).toBe(expected)
          expect((await res.json()).error).toMatch(message)
          expect(mocked.transaction).not.toHaveBeenCalled()
        }
      )

      it('returns 500 when the Discord request throws (network error)', async () => {
        fetchMock.mockRejectedValue(new TypeError('fetch failed'))

        const res = await POST(makePost())

        expect(res.status).toBe(500)
        expect((await res.json()).error).toMatch(/Failed to validate Discord channel/)
        expect(mocked.transaction).not.toHaveBeenCalled()
      })

      it('calls the Discord channels API with the bot token', async () => {
        await POST(makePost())

        expect(fetchMock).toHaveBeenCalledWith(
          `https://discord.com/api/v10/channels/${CHANNEL_ID}`,
          { headers: { Authorization: 'Bot bot-token' } }
        )
      })
    })

    describe('image upload', () => {
      const image = () => new File(['png-bytes'], 'logo.png', { type: 'image/png' })

      it('uploads the image before the DB transaction and stores the returned URL', async () => {
        const res = await POST(makePost({ image: image() }))

        expect(res.status).toBe(201)
        expect(mocked.uploadImage).toHaveBeenCalledWith(
          'project-images',
          'my-project',
          expect.any(File)
        )
        expect(mocked.uploadImage.mock.invocationCallOrder[0]).toBeLessThan(
          mocked.transaction.mock.invocationCallOrder[0]!
        )
        const { data } = txProjectCreate.mock.calls[0]![0]
        expect(data.imageUrl).toBe('https://cdn.example.com/my-project/image')
      })

      it('returns 500 and creates no project when the upload fails', async () => {
        mocked.uploadImage.mockRejectedValue(new Error('Failed to upload image: bucket down'))

        const res = await POST(makePost({ image: image() }))

        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('Failed to upload image: bucket down')
        expect(mocked.transaction).not.toHaveBeenCalled()
        expect(txProjectCreate).not.toHaveBeenCalled()
        expect(revalidateTag).not.toHaveBeenCalled()
      })

      it('skips the upload and stores a null imageUrl when no image is sent', async () => {
        await POST(makePost())

        expect(mocked.uploadImage).not.toHaveBeenCalled()
        expect(txProjectCreate.mock.calls[0]![0].data.imageUrl).toBeNull()
      })

      it('skips the upload for an empty file', async () => {
        await POST(makePost({ image: new File([], 'empty.png', { type: 'image/png' }) }))

        expect(mocked.uploadImage).not.toHaveBeenCalled()
      })
    })

    describe('success', () => {
      it('returns 201 with the created project and revalidates the projects tag', async () => {
        const res = await POST(makePost())

        expect(res.status).toBe(201)
        expect(await res.json()).toMatchObject({
          id: 'proj-1',
          name: 'My Project',
          slug: 'my-project',
        })
        expect(revalidateTag).toHaveBeenCalledWith('projects')
      })

      it('creates the project with trimmed fields, slug, repos, and channels', async () => {
        await POST(
          makePost({
            projectName: '  Big  Cool   Project ',
            projectDescription: '  hello  ',
            discordChannelNames: ['  general  '],
          })
        )

        expect(txProjectCreate).toHaveBeenCalledWith({
          data: {
            name: 'Big  Cool   Project',
            slug: 'big-cool-project',
            description: 'hello',
            startedAt: new Date(Date.UTC(2024, 2)),
            imageUrl: null,
            repositories: {
              create: [{ owner: 'acme', name: 'widgets', installationId: 'install-1' }],
            },
            channels: { create: [{ externalId: CHANNEL_ID, name: 'general' }] },
          },
          include: { repositories: true, channels: true },
        })
      })

      it('parses startedAt from YYYY-MM as the first of the month in UTC', async () => {
        await POST(makePost({ projectStartDate: '2025-12' }))

        expect(txProjectCreate.mock.calls[0]![0].data.startedAt).toEqual(
          new Date('2025-12-01T00:00:00.000Z')
        )
      })

      it('sets startedAt to null when the start date is empty', async () => {
        const res = await POST(makePost({ projectStartDate: '' }))

        expect(res.status).toBe(201)
        expect(txProjectCreate.mock.calls[0]![0].data.startedAt).toBeNull()
      })

      it('sets startedAt to null when the month is out of range', async () => {
        await POST(makePost({ projectStartDate: '2024-13' }))

        expect(txProjectCreate.mock.calls[0]![0].data.startedAt).toBeNull()
      })

      it('stores a null description when it is blank', async () => {
        await POST(makePost({ projectDescription: '   ' }))

        expect(txProjectCreate.mock.calls[0]![0].data.description).toBeNull()
      })

      it('returns 500 and does not revalidate when the transaction fails', async () => {
        mocked.transaction.mockRejectedValue(new Error('db down'))

        const res = await POST(makePost())

        expect(res.status).toBe(500)
        expect((await res.json()).error).toBe('db down')
        expect(revalidateTag).not.toHaveBeenCalled()
      })
    })
  })

  describe('GET', () => {
    it('returns only active projects with their repos and channels', async () => {
      const projects = [
        { id: 'p1', name: 'One', repositories: [{ id: 'r1' }], channels: [{ id: 'c1' }] },
        { id: 'p2', name: 'Two', repositories: [], channels: [] },
      ]
      mocked.projectFindMany.mockResolvedValue(projects)

      const res = await GET()

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual(projects)
      expect(mocked.projectFindMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { repositories: true, channels: true },
      })
    })

    it('returns 500 on a database error', async () => {
      mocked.projectFindMany.mockRejectedValue(new Error('db down'))

      const res = await GET()

      expect(res.status).toBe(500)
      expect(await res.json()).toEqual({ error: 'Failed to fetch projects' })
    })
  })
})

describe('validateGitHubLinkFormat', () => {
  it('accepts a valid repo link', () => {
    expect(validateGitHubLinkFormat('https://github.com/acme/widgets')).toBe(true)
  })

  it('rejects a trailing slash', () => {
    expect(validateGitHubLinkFormat('https://github.com/acme/widgets/')).toBe(false)
  })

  it('rejects extra path segments', () => {
    expect(validateGitHubLinkFormat('https://github.com/acme/widgets/tree/main')).toBe(false)
  })

  it('rejects http://', () => {
    expect(validateGitHubLinkFormat('http://github.com/acme/widgets')).toBe(false)
  })

  it('rejects a missing repo segment', () => {
    expect(validateGitHubLinkFormat('https://github.com/acme')).toBe(false)
  })

  it('rejects something that is not a URL', () => {
    expect(validateGitHubLinkFormat('not a url')).toBe(false)
  })
})

describe('parseGitHubRepo', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('parses owner and repo from a valid link', () => {
    expect(parseGitHubRepo('https://github.com/acme/widgets')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('ignores a trailing slash', () => {
    expect(parseGitHubRepo('https://github.com/acme/widgets/')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('uses only the first two path segments when there are extras', () => {
    expect(parseGitHubRepo('https://github.com/acme/widgets/tree/main')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('does not check the protocol, so http:// still parses', () => {
    expect(parseGitHubRepo('http://github.com/acme/widgets')).toEqual({
      owner: 'acme',
      repo: 'widgets',
    })
  })

  it('returns null when the repo segment is missing', () => {
    expect(parseGitHubRepo('https://github.com/acme')).toBeNull()
    expect(parseGitHubRepo('https://github.com/')).toBeNull()
  })

  it('returns null and logs when the input is not a URL', () => {
    expect(parseGitHubRepo('not a url')).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})

describe('validateGitHubExists', () => {
  const octokitRequest = vi.fn()

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('GITHUB_APP_INSTALLATION_ID', 'install-1')
    mocked.getInstallationOctokit.mockResolvedValue({ request: octokitRequest })
    octokitRequest.mockResolvedValue({})

    return () => vi.unstubAllEnvs()
  })

  it('returns null when the repo exists', async () => {
    expect(await validateGitHubExists(REPO_URL)).toBeNull()
  })

  it('returns 400 for a link that cannot be parsed', async () => {
    const res = await validateGitHubExists('not a url')

    expect(res?.status).toBe(400)
    expect(octokitRequest).not.toHaveBeenCalled()
  })

  it('returns 500 when the installation ID is not configured', async () => {
    vi.stubEnv('GITHUB_APP_INSTALLATION_ID', '')

    const res = await validateGitHubExists(REPO_URL)

    expect(res?.status).toBe(500)
    expect(mocked.getInstallationOctokit).not.toHaveBeenCalled()
  })
})

describe('validateSnowflakeExists', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubEnv('DISCORD_BOT_TOKEN', 'bot-token')
    vi.stubGlobal('fetch', fetchMock)

    return () => {
      vi.unstubAllEnvs()
      vi.unstubAllGlobals()
    }
  })

  it('returns null when Discord responds ok', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    expect(await validateSnowflakeExists(CHANNEL_ID)).toBeNull()
  })

  it.each([404, 403, 401, 500])(
    'returns a %i response for a non-ok %i from Discord',
    async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status })

      const res = await validateSnowflakeExists(CHANNEL_ID)

      expect(res?.status).toBe(status)
      expect((await res!.json()).error).toContain(CHANNEL_ID)
    }
  )

  it('returns 500 when fetch throws', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'))

    const res = await validateSnowflakeExists(CHANNEL_ID)

    expect(res?.status).toBe(500)
  })
})
