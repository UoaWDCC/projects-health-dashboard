import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  class KnownRequestError extends Error {
    constructor(public code: string) {
      super(code)
    }
  }

  const db = {
    projectMember: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    person: { findUnique: vi.fn(), create: vi.fn() },
    personIdentity: { findFirst: vi.fn() },
    project: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  }

  return {
    db,
    hasRole: vi.fn(),
    resolveGithubIdentity: vi.fn(),
    resolveDiscordIdentity: vi.fn(),
    uploadImage: vi.fn(),
    KnownRequestError,
  }
})

vi.mock('@repo/db', () => ({
  db: mocks.db,
  Prisma: { PrismaClientKnownRequestError: mocks.KnownRequestError },
}))
vi.mock('@/lib/auth', () => ({ hasRole: mocks.hasRole }))
vi.mock('@/lib/identity/resolve', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/identity/resolve')>('@/lib/identity/resolve')
  return {
    ...actual,
    resolveGithubIdentity: mocks.resolveGithubIdentity,
    resolveDiscordIdentity: mocks.resolveDiscordIdentity,
  }
})
vi.mock('@/lib/storage', () => ({ uploadImage: mocks.uploadImage }))

import { IdentityResolutionError } from '@/lib/identity/resolve'
import { MAX_IMAGE_BYTES } from '@/lib/schemas/admin'
import { GET, POST } from './route'

const params = { params: Promise.resolve({ slug: 'test-project' }) }

function formRequest(values: Record<string, string | File> = {}, contentLength?: number) {
  const form = new FormData()
  for (const [key, value] of Object.entries(values)) form.append(key, value)
  return new Request('http://localhost/api/project/test-project/members', {
    method: 'POST',
    headers: contentLength === undefined ? undefined : { 'content-length': String(contentLength) },
    body: form,
  })
}

function member(overrides: Record<string, unknown> = {}) {
  return {
    id: 'membership-1',
    isActive: true,
    displayName: 'Member Name',
    person: { id: 'person-1' },
    ...overrides,
  }
}

describe('project members API route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.hasRole.mockResolvedValue(true)
    mocks.db.projectMember.findMany.mockResolvedValue([])
    mocks.db.person.findUnique.mockResolvedValue(null)
    mocks.db.personIdentity.findFirst.mockResolvedValue(null)
    mocks.db.project.findUnique.mockResolvedValue({ id: 'project-1' })
    mocks.db.projectMember.findFirst.mockResolvedValue(null)
    mocks.db.person.create.mockResolvedValue({ id: 'new-person' })
    mocks.db.projectMember.create.mockResolvedValue(member())
    mocks.db.projectMember.update.mockResolvedValue(member())
    mocks.db.$transaction.mockImplementation((callback: (tx: typeof mocks.db) => unknown) =>
      callback(mocks.db)
    )
    mocks.resolveGithubIdentity.mockResolvedValue({ externalId: 'github-id', username: 'octo' })
    mocks.resolveDiscordIdentity.mockResolvedValue({
      externalId: 'discord-id',
      username: 'discord-user',
    })
    mocks.uploadImage.mockResolvedValue('https://cdn.example/person.png')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
  })

  it('forbids non-admins from listing or adding members', async () => {
    mocks.hasRole.mockResolvedValue(false)

    expect((await GET(new Request('http://localhost'), params)).status).toBe(403)
    expect((await POST(formRequest({ displayName: 'Ada' }), params)).status).toBe(403)
  })

  it('lists only active members with their people and identities, and reports database errors', async () => {
    const members = [member({ person: { id: 'person-1', identities: [{ provider: 'GITHUB' }] } })]
    mocks.db.projectMember.findMany.mockResolvedValueOnce(members)

    const response = await GET(new Request('http://localhost'), params)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(members)
    expect(mocks.db.projectMember.findMany).toHaveBeenCalledWith({
      where: { isActive: true, project: { slug: 'test-project' } },
      include: { person: { include: { identities: true } } },
    })

    mocks.db.projectMember.findMany.mockRejectedValueOnce(new Error('database down'))
    expect((await GET(new Request('http://localhost'), params)).status).toBe(500)
  })

  it('rejects requests over the image size limit and invalid new-person input', async () => {
    expect((await POST(formRequest({}, MAX_IMAGE_BYTES + 1024 * 1024 + 1), params)).status).toBe(
      413
    )
    expect((await POST(formRequest(), params)).status).toBe(400)
    expect(
      (await POST(formRequest({ displayName: 'Ada', imageUrl: 'not-a-url' }), params)).status
    ).toBe(400)
  })

  it('returns 404 for an unknown selected person and uses a selected person’s display name', async () => {
    expect((await POST(formRequest({ personId: 'missing' }), params)).status).toBe(404)

    mocks.db.person.findUnique.mockResolvedValueOnce({ id: 'person-1', displayName: 'Stored Name' })
    const response = await POST(
      formRequest({ personId: 'person-1', displayName: 'Submitted Name' }),
      params
    )

    expect(response.status).toBe(201)
    expect(mocks.db.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ personId: 'person-1', displayName: 'Stored Name' }),
      })
    )
  })

  it('detects conflicting CSV identities and links a single matching identity without creating a person', async () => {
    mocks.db.personIdentity.findFirst
      .mockResolvedValueOnce({ personId: 'github-person' })
      .mockResolvedValueOnce({ personId: 'discord-person' })
    expect(
      (await POST(formRequest({ displayName: 'Ada', githubId: 'octo', discordId: 'ada' }), params))
        .status
    ).toBe(409)

    mocks.db.personIdentity.findFirst.mockReset()
    mocks.db.personIdentity.findFirst
      .mockResolvedValueOnce({ personId: 'github-person' })
      .mockResolvedValueOnce(null)
    const response = await POST(
      formRequest({ displayName: 'Ada', githubId: 'octo', discordId: 'ada' }),
      params
    )

    expect(response.status).toBe(201)
    expect(mocks.db.person.create).not.toHaveBeenCalled()
    expect(mocks.db.projectMember.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ personId: 'github-person' }) })
    )
  })

  it('creates identities only for resolved providers and prefers an uploaded image to the CSV URL', async () => {
    const image = new File(['image'], 'person.png', { type: 'image/png' })
    await POST(
      formRequest({
        displayName: 'Ada',
        githubId: 'octo',
        imageUrl: 'https://csv.example/ada.png',
        image,
      }),
      params
    )

    expect(mocks.uploadImage).toHaveBeenCalledWith(
      'person-images',
      expect.any(String),
      expect.any(File)
    )
    expect(mocks.db.person.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        displayName: 'Ada',
        imageUrl: 'https://cdn.example/person.png',
        identities: { create: [{ provider: 'GITHUB', externalId: 'github-id', username: 'octo' }] },
      }),
    })
  })

  it('uses the CSV image for a new person and never uploads an image for a selected existing person', async () => {
    await POST(formRequest({ displayName: 'Ada', imageUrl: 'https://csv.example/ada.png' }), params)
    expect(mocks.db.person.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ imageUrl: 'https://csv.example/ada.png' }),
      })
    )

    mocks.db.person.findUnique.mockResolvedValueOnce({ id: 'person-1', displayName: 'Ada' })
    await POST(
      formRequest({
        personId: 'person-1',
        image: new File(['image'], 'person.png', { type: 'image/png' }),
      }),
      params
    )
    expect(mocks.uploadImage).not.toHaveBeenCalled()
  })

  it('returns 200 for active members, reactivates inactive members, and creates new memberships', async () => {
    mocks.db.person.findUnique.mockResolvedValue({ id: 'person-1', displayName: 'Ada' })
    mocks.db.projectMember.findFirst.mockResolvedValueOnce(member())
    const active = await POST(formRequest({ personId: 'person-1' }), params)
    expect(active.status).toBe(200)
    expect((await active.json()).outcome).toBe('already_member')

    mocks.db.projectMember.findFirst.mockResolvedValueOnce(member({ isActive: false }))
    const inactive = await POST(formRequest({ personId: 'person-1' }), params)
    expect(inactive.status).toBe(201)
    expect(mocks.db.projectMember.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: true, displayName: 'Ada' } })
    )

    mocks.db.projectMember.findFirst.mockResolvedValueOnce(null)
    expect((await POST(formRequest({ personId: 'person-1' }), params)).status).toBe(201)
  })

  it('preserves identity error statuses and maps duplicate identities and missing projects', async () => {
    mocks.resolveGithubIdentity.mockRejectedValueOnce(
      new IdentityResolutionError('GitHub unavailable', 429)
    )
    expect((await POST(formRequest({ displayName: 'Ada', githubId: 'octo' }), params)).status).toBe(
      429
    )

    mocks.db.projectMember.create.mockRejectedValueOnce(new mocks.KnownRequestError('P2002'))
    expect((await POST(formRequest({ displayName: 'Ada' }), params)).status).toBe(409)

    mocks.db.project.findUnique.mockResolvedValueOnce(null)
    expect((await POST(formRequest({ displayName: 'Ada' }), params)).status).toBe(404)
  })
})
