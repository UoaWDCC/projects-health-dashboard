import { GET, PUT } from './route'
import { db } from '@repo/db'
import { hasRole } from '@/lib/auth'
import { updatePersonSchema } from '@/lib/schemas/admin'

vi.mock('@repo/db', () => ({
  db: {
    person: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    projectMember: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/auth', () => ({
  hasRole: vi.fn(),
}))

vi.mock('@/lib/schemas/admin', () => ({
  updatePersonSchema: {
    safeParse: vi.fn(),
  },
}))

const mockDb = db as unknown as {
  person: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> }
  projectMember: { updateMany: ReturnType<typeof vi.fn> }
  $transaction: ReturnType<typeof vi.fn>
}
const mockHasRole = hasRole as unknown as ReturnType<typeof vi.fn>
const mockSafeParse = updatePersonSchema.safeParse as unknown as ReturnType<typeof vi.fn>

function makeParams(personId = 'person-1') {
  return { params: Promise.resolve({ personId }) }
}

function makeRequest(body?: unknown) {
  return {
    json: vi.fn().mockResolvedValue(body ?? {}),
  } as unknown as Request
}

// $transaction in the real code receives a callback and runs it with a tx
// object shaped like db itself. This wires that up for tests that need the
// cascade logic to actually execute.
function wireTransaction() {
  mockDb.$transaction.mockImplementation(async (cb: (tx: typeof mockDb) => unknown) => {
    return cb(mockDb)
  })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/people/[personId]', () => {
  it('returns 403 for non-admins', async () => {
    mockHasRole.mockResolvedValue(false)

    const res = await GET(makeRequest(), makeParams())

    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toMatch(/admin/i)
    expect(mockDb.person.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown person', async () => {
    mockHasRole.mockResolvedValue(true)
    mockDb.person.findUnique.mockResolvedValue(null)

    const res = await GET(makeRequest(), makeParams('missing-id'))

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/not found/i)
  })

  it('returns the person including identities and memberships with their project', async () => {
    mockHasRole.mockResolvedValue(true)
    const person = {
      id: 'person-1',
      displayName: 'Oshan Paki',
      identities: [{ id: 'identity-1', provider: 'github' }],
      memberships: [
        {
          id: 'membership-1',
          displayName: 'Oshan P',
          project: { id: 'project-1', name: 'Oshnap' },
        },
      ],
    }
    mockDb.person.findUnique.mockResolvedValue(person)

    const res = await GET(makeRequest(), makeParams('person-1'))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual(person)
    expect(mockDb.person.findUnique).toHaveBeenCalledWith({
      where: { id: 'person-1' },
      include: {
        identities: true,
        memberships: {
          include: { project: true },
        },
      },
    })
  })

  it('returns 500 when the database throws', async () => {
    mockHasRole.mockResolvedValue(true)
    mockDb.person.findUnique.mockRejectedValue(new Error('db exploded'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await GET(makeRequest(), makeParams())

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toMatch(/failed to fetch/i)
    consoleSpy.mockRestore()
  })
})

describe('PUT /api/people/[personId]', () => {
  const oldPerson = {
    id: 'person-1',
    displayName: 'Oshan Paki',
    imageUrl: 'https://example.com/old.png',
  }

  it('returns 403 for non-admins', async () => {
    mockHasRole.mockResolvedValue(false)

    const res = await PUT(makeRequest({ displayName: 'New Name' }), makeParams())

    expect(res.status).toBe(403)
    expect(mockDb.person.findUnique).not.toHaveBeenCalled()
  })

  it('returns 400 for an invalid body (e.g. empty display name or bad image URL)', async () => {
    mockHasRole.mockResolvedValue(true)
    mockSafeParse.mockReturnValue({
      success: false,
      error: { issues: [{ message: 'Display name cannot be empty' }] },
    })

    const res = await PUT(makeRequest({ displayName: '' }), makeParams())

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Display name cannot be empty')
    expect(mockDb.person.findUnique).not.toHaveBeenCalled()
  })

  it('returns 404 for an unknown person', async () => {
    mockHasRole.mockResolvedValue(true)
    mockSafeParse.mockReturnValue({ success: true, data: { displayName: 'New Name' } })
    mockDb.person.findUnique.mockResolvedValue(null)

    const res = await PUT(makeRequest({ displayName: 'New Name' }), makeParams('missing-id'))

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/not found/i)
    expect(mockDb.$transaction).not.toHaveBeenCalled()
  })

  describe('display name cascade', () => {
    beforeEach(() => {
      mockHasRole.mockResolvedValue(true)
      mockDb.person.findUnique.mockResolvedValue(oldPerson)
      wireTransaction()
      mockDb.person.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...oldPerson, ...data })
      )
      mockDb.projectMember.updateMany.mockResolvedValue({ count: 1 })
    })

    it('without forceCascade, only updates memberships with a null, empty, or old display name', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { displayName: 'Oshan Paki', forceCascade: false },
      })

      const res = await PUT(makeRequest({ displayName: 'Oshan Paki' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.projectMember.updateMany).toHaveBeenCalledWith({
        where: {
          personId: 'person-1',
          OR: [{ displayName: null }, { displayName: '' }, { displayName: 'Oshan Paki' }],
        },
        data: { displayName: 'Oshan Paki' },
      })
    })

    it('with forceCascade, updates every membership regardless of its current display name', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { displayName: 'Oshan Paki', forceCascade: true },
      })

      const res = await PUT(makeRequest({ displayName: 'Oshan Paki' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.projectMember.updateMany).toHaveBeenCalledWith({
        where: { personId: 'person-1' },
        data: { displayName: 'Oshan Paki' },
      })
    })

    it('leaves memberships alone when the display name is unchanged', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { displayName: 'Oshan Paki', forceCascade: false },
      })

      const res = await PUT(makeRequest({ displayName: 'Oshan Paki' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.projectMember.updateMany).not.toHaveBeenCalled()
    })

    it('leaves memberships alone when displayName is missing from the request', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { imageUrl: 'https://example.com/new.png' },
      })

      const res = await PUT(makeRequest({ imageUrl: 'https://example.com/new.png' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.projectMember.updateMany).not.toHaveBeenCalled()
    })

    it('trims the display name before saving and cascading', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { displayName: '  Oshan Paki  ', forceCascade: false },
      })

      await PUT(makeRequest({ displayName: '  Oshan Paki  ' }), makeParams())

      expect(mockDb.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ displayName: 'Oshan Paki' }) })
      )
      expect(mockDb.projectMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { displayName: 'Oshan Paki' } })
      )
    })
  })

  describe('image URL handling', () => {
    beforeEach(() => {
      mockHasRole.mockResolvedValue(true)
      mockDb.person.findUnique.mockResolvedValue(oldPerson)
      wireTransaction()
      mockDb.person.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ ...oldPerson, ...data })
      )
    })

    it('clears the image when imageUrl is an empty string', async () => {
      mockSafeParse.mockReturnValue({ success: true, data: { imageUrl: '' } })

      const res = await PUT(makeRequest({ imageUrl: '' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ imageUrl: null }) })
      )
    })

    it('clears the image when imageUrl is null', async () => {
      mockSafeParse.mockReturnValue({ success: true, data: { imageUrl: null } })

      const res = await PUT(makeRequest({ imageUrl: null }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.person.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ imageUrl: null }) })
      )
    })

    it('keeps the existing image when imageUrl is missing from the request', async () => {
      mockSafeParse.mockReturnValue({ success: true, data: { displayName: 'Oshan Paki' } })

      const res = await PUT(makeRequest({ displayName: 'Oshan Paki' }), makeParams())

      expect(res.status).toBe(200)
      expect(mockDb.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: oldPerson.imageUrl }),
        })
      )
    })

    it('trims a provided imageUrl', async () => {
      mockSafeParse.mockReturnValue({
        success: true,
        data: { imageUrl: '  https://example.com/new.png  ' },
      })

      await PUT(makeRequest({ imageUrl: '  https://example.com/new.png  ' }), makeParams())

      expect(mockDb.person.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ imageUrl: 'https://example.com/new.png' }),
        })
      )
    })
  })

  it('returns 500 when the database throws', async () => {
    mockHasRole.mockResolvedValue(true)
    mockSafeParse.mockReturnValue({ success: true, data: { displayName: 'Oshan Paki' } })
    mockDb.person.findUnique.mockResolvedValue(oldPerson)
    mockDb.$transaction.mockRejectedValue(new Error('db exploded'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await PUT(makeRequest({ displayName: 'Oshan Paki' }), makeParams())

    expect(res.status).toBe(500)
    const json = await res.json()
    expect(json.error).toBe('db exploded')
    consoleSpy.mockRestore()
  })
})
