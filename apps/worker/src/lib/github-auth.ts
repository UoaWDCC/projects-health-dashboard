let appPromise: Promise<{
  getInstallationOctokit: (installationId: number) => Promise<unknown>
}> | null = null

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
  const app = await getApp()
  return app.getInstallationOctokit(Number(installationId))
}
