import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { db } from '@repo/db'
import { GET } from './route'

const findFirst = db.gitHubRepository.findFirst as Mock

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL('http://localhost/api/project/check-repo')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return new Request(url)
}

const repoWithCounts = (commits: number, prs: number) => ({
  id: 'repo-1',
  owner: 'acme',
  name: 'widgets',
  _count: { commits, prs },
})

describe('GET /api/project/check-repo', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('missing params', () => {
    it.each([
      ['owner', { name: 'widgets' }],
      ['name', { owner: 'acme' }],
      ['both', {}],
      ['an empty owner', { owner: '', name: 'widgets' }],
      ['an empty name', { owner: 'acme', name: '' }],
    ])('returns 400 when %s is missing', async (_label, params) => {
      const res = await GET(makeRequest(params))

      expect(res.status).toBe(400)
      expect(await res.json()).toEqual({ error: 'Missing owner or name parameter' })
      expect(findFirst).not.toHaveBeenCalled()
    })
  })

  describe('hasData', () => {
    it('looks the repo up by owner and name with commit and PR counts', async () => {
      findFirst.mockResolvedValue(repoWithCounts(1, 1))

      await GET(makeRequest({ owner: 'acme', name: 'widgets' }))

      expect(findFirst).toHaveBeenCalledWith({
        where: { owner: 'acme', name: 'widgets' },
        include: { _count: { select: { commits: true, prs: true } } },
      })
    })

    it.each([
      ['commits and PRs', 3, 2, true],
      ['only commits', 5, 0, true],
      ['only PRs', 0, 4, true],
      ['no commits or PRs', 0, 0, false],
    ])('returns hasData for a repo with %s', async (_label, commits, prs, expected) => {
      findFirst.mockResolvedValue(repoWithCounts(commits, prs))

      const res = await GET(makeRequest({ owner: 'acme', name: 'widgets' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ hasData: expected })
    })

    it('returns hasData false for an unknown repo', async () => {
      findFirst.mockResolvedValue(null)

      const res = await GET(makeRequest({ owner: 'nobody', name: 'nothing' }))

      expect(res.status).toBe(200)
      expect(await res.json()).toEqual({ hasData: false })
    })
  })

  it('returns 500 on a database error', async () => {
    findFirst.mockRejectedValue(new Error('db down'))

    const res = await GET(makeRequest({ owner: 'acme', name: 'widgets' }))

    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Failed to check repository' })
  })
})
