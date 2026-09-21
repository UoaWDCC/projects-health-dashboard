import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@repo/db'
import { revalidateTag } from 'next/cache'
import { hasRole } from '@/lib/auth'
import { MAX_IMAGE_BYTES } from '@/lib/schemas/admin'
import { copyImage, deleteImage, uploadImage } from '@/lib/storage'
import { validateGitHubExists, validateSnowflakeExists } from '../route'
import { PATCH } from './route'

vi.mock('@repo/db', () => ({
  db: {
    project: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    gitHubRepository: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    discordChannel: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@repo/github', () => ({
  getInstallationOctokit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  hasRole: vi.fn(),
}))

vi.mock('@/lib/storage', () => ({
  uploadImage: vi.fn(),
  deleteImage: vi.fn(),
  copyImage: vi.fn(),
}))

vi.mock('../route', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../route')>()
  return {
    ...actual,
    validateGitHubExists: vi.fn(),
    validateSnowflakeExists: vi.fn(),
  }
})

const PROJECT_ID = 'project-id'
const OLD_SLUG = 'old-project'
const INSTALLATION_ID = '123'
const OLD_IMAGE_URL = 'https://cdn.example.com/project-images/old-project/image'

type FormValue = string | string[] | File

const baseFields: Record<string, FormValue> = {
  projectName: 'Old Project',
  projectDescription: 'A description',
  githubLinks: ['https://github.com/owner/name'],
  discordSnowflakeIds: ['111'],
  discordChannelNames: ['general'],
}

interface RequestOptions {
  slug?: string
  headers?: Record<string, string>
}

interface ProjectRow {
  id: string
  slug: string
  name: string
  imageUrl: string | null
  repositories?: Array<{ id: string; owner: string; name: string }>
  channels?: Array<{ id: string; externalId: string; name: string }>
}

async function callPatch(
  newFields: Record<string, FormValue | undefined> = {},
  { slug = OLD_SLUG, headers = {} }: RequestOptions = {}
) {
  // Merge the base fields with any new fields provided to get the final set of fields for the request.
  const fields: Record<string, FormValue | undefined> = { ...baseFields, ...newFields }
  const formData = new FormData()
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    const values = Array.isArray(value) ? value : [value]
    for (const v of values) formData.append(key, v)
  }
  const request = new Request(`http://localhost/api/project/${slug}`, {
    method: 'PATCH',
    body: formData,
    headers,
  })
  return PATCH(request, { params: Promise.resolve({ slug }) })
}

function makeImageFile(name = 'profile.png') {
  return new File(['image-size'], name, { type: 'image/png' })
}

// Sets up the mocks for a happy path scenario, with optional overrides for existing project, current repos/channels, and final project state.
function setupHappyPath({
  existingProject = { id: PROJECT_ID, slug: OLD_SLUG, name: 'Old Project', imageUrl: null },
  currentRepos = [] as Array<{ id: string; owner: string; name: string; isActive: boolean }>,
  currentChannels = [] as Array<{
    id: string
    externalId: string
    name: string
    isActive: boolean
  }>,
  finalProject = {
    id: PROJECT_ID,
    slug: OLD_SLUG,
    name: 'Old Project',
    imageUrl: null,
    repositories: [{ id: 'repo-1', owner: 'owner', name: 'repo' }],
    channels: [{ id: 'channel-1', externalId: '111', name: 'general' }],
  },
}: {
  existingProject?: ProjectRow
  currentRepos?: Array<{ id: string; owner: string; name: string; isActive: boolean }>
  currentChannels?: Array<{ id: string; externalId: string; name: string; isActive: boolean }>
  finalProject?: ProjectRow
} = {}) {
  vi.mocked(hasRole).mockResolvedValue(true)
  vi.mocked(validateGitHubExists).mockResolvedValue(null)
  vi.mocked(validateSnowflakeExists).mockResolvedValue(null)

  // project is found with no clashes, by default.
  vi.mocked(db.project.findFirst).mockResolvedValue(existingProject as never)
  vi.mocked(db.project.findMany).mockResolvedValue([] as never)
  vi.mocked(db.project.findUnique).mockImplementation(((args: { include?: unknown }) =>
    Promise.resolve(args?.include ? finalProject : existingProject)) as never)
  vi.mocked(db.project.update).mockResolvedValue({} as never)

  // No repo active on another project, and no orphaned row to take over, by default.
  vi.mocked(db.gitHubRepository.findFirst).mockResolvedValue(null as never)
  vi.mocked(db.gitHubRepository.findMany).mockResolvedValue(currentRepos as never)
  vi.mocked(db.gitHubRepository.update).mockResolvedValue({} as never)
  vi.mocked(db.gitHubRepository.updateMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(db.gitHubRepository.create).mockResolvedValue({} as never)

  // No channel active on another project, and no orphaned row to take over, by default.
  vi.mocked(db.discordChannel.findUnique).mockResolvedValue(null as never)
  vi.mocked(db.discordChannel.findMany).mockResolvedValue(currentChannels as never)
  vi.mocked(db.discordChannel.update).mockResolvedValue({} as never)
  vi.mocked(db.discordChannel.updateMany).mockResolvedValue({ count: 0 } as never)
  vi.mocked(db.discordChannel.create).mockResolvedValue({} as never)

  vi.mocked(db.$transaction).mockImplementation(((fn: (tx: typeof db) => unknown) =>
    fn(db)) as never)

  vi.mocked(uploadImage).mockResolvedValue('https://cdn.example/upload')
  vi.mocked(copyImage).mockResolvedValue('https://cdn.example/copy')
  vi.mocked(deleteImage).mockResolvedValue(undefined)
}

describe('PATCH /api/project/[slug]', () => {
  beforeEach(() => {
    vi.stubEnv('GITHUB_APP_INSTALLATION_ID', INSTALLATION_ID)
    vi.spyOn(console, 'error').mockImplementation(() => {})
    setupHappyPath()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('guards', () => {
    it('returns 403 when the caller is not an admin', async () => {
      vi.mocked(hasRole).mockResolvedValue(false)

      const res = await callPatch()

      expect(res.status).toBe(403)
      expect(hasRole).toHaveBeenCalledWith('ADMIN')
      expect(db.project.findFirst).not.toHaveBeenCalled()
    })

    it('returns 413 when the request exceeds the size limit', async () => {
      const tooLargeSize = MAX_IMAGE_BYTES + 1024 * 1024 + 1

      const res = await callPatch({}, { headers: { 'content-length': String(tooLargeSize) } })

      expect(res.status).toBe(413)
      expect(db.project.findFirst).not.toHaveBeenCalled()
    })

    it('returns 500 when the GitHub installation ID is not configured', async () => {
      vi.stubEnv('GITHUB_APP_INSTALLATION_ID', '')

      const res = await callPatch()

      expect(res.status).toBe(500)
      await expect(res.json()).resolves.toEqual({
        error: 'GitHub configuration error, Installation ID not found',
      })
      expect(db.project.findFirst).not.toHaveBeenCalled()
    })
  })

  describe('validation (400)', () => {
    it('returns 400 when the project name is missing', async () => {
      const res = await callPatch({ projectName: '   ' })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'Missing required fields' })
    })

    it('returns 400 when no GitHub repos are provided', async () => {
      const res = await callPatch({ githubLinks: undefined })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'Missing required fields' })
    })

    it('returns 400 when no Discord channels are provided', async () => {
      const res = await callPatch({
        discordSnowflakeIds: undefined,
        discordChannelNames: undefined,
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'Missing required fields' })
    })

    it('returns 400 when the channel ID and channel name counts differ', async () => {
      const res = await callPatch({
        discordSnowflakeIds: ['111', '222'],
        discordChannelNames: ['general'],
      })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'Missing required fields' })
    })

    it('returns 400 when more than 20 repos are provided', async () => {
      const links = Array.from({ length: 21 }, (_, i) => `https://github.com/owner/name-${i}`)

      const res = await callPatch({ githubLinks: links })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({
        error: 'Too many repos or channels linked (no more than 20 each)',
      })
    })

    it('returns 400 when more than 20 channels are provided', async () => {
      const ids = Array.from({ length: 21 }, (_, i) => String(100 + i))
      const names = Array.from({ length: 21 }, (_, i) => `channel-${i}`)

      const res = await callPatch({ discordSnowflakeIds: ids, discordChannelNames: names })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({
        error: 'Too many repos or channels linked (no more than 20 each)',
      })
    })

    it('returns 400 when a GitHub link is badly formatted', async () => {
      const res = await callPatch({ githubLinks: ['https://gitlab.com/owner/name-a'] })

      expect(res.status).toBe(400)
      await expect(res.json()).resolves.toEqual({ error: 'Invalid GitHub Repository Link' })
      expect(validateGitHubExists).not.toHaveBeenCalled()
    })
  })

  describe('conflicts (409)', () => {
    it('returns 409 when the new slug belongs to another project', async () => {
      vi.mocked(db.project.findMany).mockResolvedValue([{ id: 'other', slug: 'new-name' }] as never)

      const res = await callPatch({ projectName: 'New Name' })

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({ error: 'Project slug new-name already in use' })
      expect(db.project.findMany).toHaveBeenCalledWith({
        where: { slug: 'new-name', id: { not: PROJECT_ID } },
      })
      expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('returns 409 when a repo is active on another project', async () => {
      vi.mocked(db.gitHubRepository.findFirst).mockResolvedValue({
        id: 'repo-x',
        owner: 'owner',
        name: 'name',
        projectId: 'other-project',
        isActive: true,
      } as never)

      const res = await callPatch()

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error:
          'GitHub Repository https://github.com/owner/name has already been linked to another project',
      })
      expect(db.gitHubRepository.findFirst).toHaveBeenCalledWith({
        where: { owner: 'owner', name: 'name', projectId: { not: PROJECT_ID }, isActive: true },
      })
      expect(db.$transaction).not.toHaveBeenCalled()
    })

    it('returns 409 when a channel is active on another project', async () => {
      vi.mocked(db.discordChannel.findUnique).mockResolvedValue({
        id: 'channel-x',
        externalId: '111',
        projectId: 'other-project',
        isActive: true,
      } as never)

      const res = await callPatch()

      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toEqual({
        error: 'Discord Channel with Snowflake ID 111 has already been linked to another project',
      })
      expect(db.$transaction).not.toHaveBeenCalled()
    })
  })

  describe('repositories', () => {
    it('deactivates removed repos, reactivates kept ones and creates new ones', async () => {
      setupHappyPath({
        currentRepos: [
          { id: 'repo-kept', owner: 'owner', name: 'name', isActive: false },
          { id: 'repo-removed', owner: 'owner', name: 'removed-repo-name', isActive: true },
        ],
      })

      const res = await callPatch({
        githubLinks: ['https://github.com/owner/name', 'https://github.com/owner/new-name'],
      })

      expect(res.status).toBe(200)
      expect(db.gitHubRepository.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['repo-removed'] } },
        data: { isActive: false },
      })
      expect(db.gitHubRepository.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['repo-kept'] } },
        data: { isActive: true },
      })
      expect(db.gitHubRepository.create).toHaveBeenCalledTimes(1)
      expect(db.gitHubRepository.create).toHaveBeenCalledWith({
        data: {
          projectId: PROJECT_ID,
          owner: 'owner',
          name: 'new-name',
          installationId: INSTALLATION_ID,
          isActive: true,
        },
      })
    })

    it('takes over a new repo that is inactive on another project instead of creating it', async () => {
      const orphanRepo = {
        id: 'repo-orphan',
        owner: 'owner',
        name: 'name',
        projectId: 'other-project',
        installationId: '123',
        isActive: false,
      }
      vi.mocked(db.gitHubRepository.findFirst).mockImplementation(((args: {
        where: { isActive?: boolean }
      }) => Promise.resolve(args.where.isActive ? null : orphanRepo)) as never)

      const res = await callPatch()

      expect(res.status).toBe(200)
      expect(db.gitHubRepository.update).toHaveBeenCalledWith({
        where: { id: 'repo-orphan' },
        data: { projectId: PROJECT_ID, installationId: INSTALLATION_ID, isActive: true },
      })
      expect(db.gitHubRepository.create).not.toHaveBeenCalled()
    })
  })

  describe('Discord channels', () => {
    it('deactivates removed channels, reactivates and renames kept ones, and creates new ones', async () => {
      setupHappyPath({
        currentChannels: [
          { id: 'channel-kept', externalId: '111', name: 'general', isActive: false },
          { id: 'channel-removed', externalId: '222', name: 'announcements', isActive: true },
        ],
      })

      const res = await callPatch({
        discordSnowflakeIds: ['111', '333'],
        discordChannelNames: ['changed-name', 'new-channel'],
      })

      expect(res.status).toBe(200)
      expect(db.discordChannel.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['channel-removed'] } },
        data: { isActive: false },
      })
      expect(db.discordChannel.update).toHaveBeenCalledWith({
        where: { id: 'channel-kept' },
        data: { isActive: true, name: 'changed-name' },
      })
      expect(db.discordChannel.create).toHaveBeenCalledTimes(1)
      expect(db.discordChannel.create).toHaveBeenCalledWith({
        data: { projectId: PROJECT_ID, externalId: '333', name: 'new-channel', isActive: true },
      })
    })

    it('takes over a new channel that is inactive on another project instead of creating it', async () => {
      vi.mocked(db.discordChannel.findUnique).mockResolvedValue({
        id: 'channel-orphan',
        externalId: '111',
        name: 'general',
        projectId: 'orphan-project',
        isActive: false,
      } as never)

      const res = await callPatch({
        discordSnowflakeIds: ['111'],
        discordChannelNames: ['general'],
      })

      expect(res.status).toBe(200)
      expect(db.discordChannel.update).toHaveBeenCalledWith({
        where: { id: 'channel-orphan' },
        data: { projectId: PROJECT_ID, name: 'general', isActive: true },
      })
      expect(db.discordChannel.create).not.toHaveBeenCalled()
    })
  })

  describe('image handling', () => {
    it('uploads a new image under the new slug and deletes the old image when the slug changed', async () => {
      setupHappyPath({
        existingProject: {
          id: PROJECT_ID,
          slug: OLD_SLUG,
          name: 'Old Project',
          imageUrl: OLD_IMAGE_URL,
        },
      })
      const file = makeImageFile()

      const res = await callPatch({ projectName: 'New Name', image: file })

      expect(res.status).toBe(200)
      expect(uploadImage).toHaveBeenCalledTimes(1)
      const [bucket, slug, uploaded] = vi.mocked(uploadImage).mock.calls[0]
      expect(bucket).toBe('project-images')
      expect(slug).toBe('new-name')
      expect(uploaded).toBeInstanceOf(File)
      expect(uploaded.name).toBe('profile.png')
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({
          slug: 'new-name',
          imageUrl: 'https://cdn.example/upload',
        }),
      })
      expect(copyImage).not.toHaveBeenCalled()
      expect(deleteImage).toHaveBeenCalledWith('project-images', OLD_SLUG)
    })

    it('sets imageUrl to null and deletes the old image when removeImage is true', async () => {
      setupHappyPath({
        existingProject: {
          id: PROJECT_ID,
          slug: OLD_SLUG,
          name: 'Old Project',
          imageUrl: OLD_IMAGE_URL,
        },
      })

      const res = await callPatch({ removeImage: 'true' })

      expect(res.status).toBe(200)
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({ imageUrl: null }),
      })
      expect(deleteImage).toHaveBeenCalledWith('project-images', OLD_SLUG)
    })

    it('copies the image to the new slug then deletes the old one when renaming without a new image', async () => {
      setupHappyPath({
        existingProject: {
          id: PROJECT_ID,
          slug: OLD_SLUG,
          name: 'Old Project',
          imageUrl: OLD_IMAGE_URL,
        },
      })

      const res = await callPatch({ projectName: 'New Name' })

      expect(res.status).toBe(200)
      expect(copyImage).toHaveBeenCalledWith('project-images', OLD_SLUG, 'new-name')
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: expect.objectContaining({
          slug: 'new-name',
          imageUrl: 'https://cdn.example/copy',
        }),
      })
      expect(deleteImage).toHaveBeenCalledWith('project-images', OLD_SLUG)
      expect(vi.mocked(copyImage).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(deleteImage).mock.invocationCallOrder[0]
      )
      expect(uploadImage).not.toHaveBeenCalled()
    })

    it('logs a failed image copy and still succeeds without changing imageUrl', async () => {
      setupHappyPath({
        existingProject: {
          id: PROJECT_ID,
          slug: OLD_SLUG,
          name: 'Old Project',
          imageUrl: OLD_IMAGE_URL,
        },
      })
      const copyError = new Error('copy exploded')
      vi.mocked(copyImage).mockRejectedValue(copyError)

      const res = await callPatch({ projectName: 'New Name' })

      expect(res.status).toBe(200)
      expect(console.error).toHaveBeenCalledWith(
        'Could not align project image with new slug:',
        copyError
      )
      const updateData = vi.mocked(db.project.update).mock.calls[0][0].data
      expect(updateData).toMatchObject({ slug: 'new-name' })
      expect(updateData).not.toHaveProperty('imageUrl')
      expect(deleteImage).not.toHaveBeenCalled()
    })

    it('returns 500 before any database writes when the upload fails', async () => {
      vi.mocked(uploadImage).mockRejectedValue(new Error('bucket unavailable'))

      const res = await callPatch({ image: makeImageFile() })

      expect(res.status).toBe(500)
      await expect(res.json()).resolves.toEqual({ error: 'bucket unavailable' })
      expect(db.$transaction).not.toHaveBeenCalled()
      expect(db.project.update).not.toHaveBeenCalled()
      expect(deleteImage).not.toHaveBeenCalled()
      expect(revalidateTag).not.toHaveBeenCalled()
    })

    it('does not fail the request when deleting the old image fails', async () => {
      setupHappyPath({
        existingProject: {
          id: PROJECT_ID,
          slug: OLD_SLUG,
          name: 'Old Project',
          imageUrl: OLD_IMAGE_URL,
        },
      })
      const deleteError = new Error('delete exploded')
      vi.mocked(deleteImage).mockRejectedValue(deleteError)

      const res = await callPatch({ removeImage: 'true' })

      expect(res.status).toBe(200)
      expect(console.error).toHaveBeenCalledWith(
        'Failed to remove the previous project image:',
        deleteError
      )
    })
  })

  describe('successful update', () => {
    it('saves an empty description as null', async () => {
      const res = await callPatch({ projectDescription: '   ' })

      expect(res.status).toBe(200)
      expect(db.project.update).toHaveBeenCalledWith({
        where: { id: PROJECT_ID },
        data: { name: 'Old Project', slug: OLD_SLUG, description: null },
      })
    })

    it('calls revalidateTag("projects") and returns the project with repos and channels', async () => {
      const finalProject = {
        id: PROJECT_ID,
        slug: OLD_SLUG,
        name: 'Old Project',
        imageUrl: null,
        repositories: [{ id: 'repo-1', owner: 'owner', name: 'name', isActive: true }],
        channels: [{ id: 'channel-1', externalId: '111', name: 'general', isActive: true }],
      }
      setupHappyPath({ finalProject })

      const res = await callPatch()

      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual(finalProject)
      expect(db.project.findUnique).toHaveBeenLastCalledWith({
        where: { id: PROJECT_ID },
        include: { repositories: true, channels: true },
      })
      expect(revalidateTag).toHaveBeenCalledTimes(1)
      expect(revalidateTag).toHaveBeenCalledWith('projects')
    })
  })
})
