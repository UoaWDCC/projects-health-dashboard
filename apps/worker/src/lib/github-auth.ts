type InstallationOctokit = Awaited<
  ReturnType<
    import('octokit', { with: { 'resolution-mode': 'import' } }).App['getInstallationOctokit']
  >
>

// Kept intentionally minimal to avoid CJS/ESM type import issues with octokit.
type GitHubAppClient = {
  octokit: {
    request: (
      route: string,
      parameters?: Record<string, unknown>
    ) => Promise<{ data: { id?: number; account?: { login?: string } } }>
  }
  getInstallationOctokit: (installationId: number) => Promise<InstallationOctokit>
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
