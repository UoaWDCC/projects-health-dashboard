import { vi } from 'vitest'

export const mockGetInstallationOctokit = vi.fn()

vi.mock('../../lib/github-auth', () => ({
  getInstallationOctokit: mockGetInstallationOctokit,
}))

export function mockOctokitWithRequests(responses: Record<string, object>) {
  mockGetInstallationOctokit.mockResolvedValue({
    request: vi.fn().mockImplementation((route: string) => {
      const data = responses[route]
      if (!data) throw new Error(`Unexpected request: ${route}`)
      return Promise.resolve({ data })
    }),
    paginate: vi.fn().mockResolvedValueOnce([]),
  })
}
