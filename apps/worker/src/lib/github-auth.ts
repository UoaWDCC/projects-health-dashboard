type GitHubAppClient = {
  octokit: {
    request: (
      route: string,
      parameters?: Record<string, string>
    ) => Promise<{ data: { id?: number; account?: { login?: string } } }>
  }
  getInstallationOctokit: (installationId: number) => Promise<unknown>
}

let appPromise: Promise<GitHubAppClient> | null = null

async function getApp() {
  if (!appPromise) {
    appPromise = (async () => {
      const { App } = await import('octokit')

      const appId = process.env.GITHUB_APP_ID
      const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY

      if (!appId) {
        throw new Error('Missing GITHUB_APP_ID')
      }

      if (!rawPrivateKey) {
        throw new Error('Missing GITHUB_APP_PRIVATE_KEY')
      }

      const privateKey = rawPrivateKey.replace(/\\n/g, '\n')

      return new App({
        appId,
        privateKey,
      })
    })()
  }

  return appPromise
}

export async function getInstallationOctokit(installationId: string | number) {
  const normalizedInstallationId = Number(installationId)

  if (!Number.isInteger(normalizedInstallationId) || normalizedInstallationId <= 0) {
    throw new Error(`Invalid GitHub installation ID: ${installationId}`)
  }

  const app = await getApp()
  return app.getInstallationOctokit(normalizedInstallationId)
}

export async function getAppOctokit() {
  const app = await getApp()
  return app.octokit
}

export async function getRepositoryInstallationId(owner: string, repo: string): Promise<number> {
  const octokit = await getAppOctokit()

  const response = await octokit.request('GET /repos/{owner}/{repo}/installation', {
    owner,
    repo,
  })

  if (!response.data.id) {
    throw new Error(`No installation ID returned for ${owner}/${repo}`)
  }

  return response.data.id
}
