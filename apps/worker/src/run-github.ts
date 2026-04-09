import { getRepositoryInstallationId } from './lib/github-auth'
import { logger } from './lib/logger'

const repositories = [
  { owner: 'projects', name: 'new' },
  { owner: 'UoaWDCC', name: 'uoavc' },
  { owner: 'UoaWDCC', name: 'projects-health-dashboard' },
]

async function main() {
  logger.info(`Looking up GitHub App installation IDs for ${repositories.length} repositories`)

  for (const repository of repositories) {
    try {
      const installationId = await getRepositoryInstallationId(repository.owner, repository.name)

      logger.info(`${repository.owner}/${repository.name} -> installationId=${installationId}`)
    } catch (error) {
      logger.error(
        `Failed to find installation ID for ${repository.owner}/${repository.name}`,
        error
      )
    }
  }

  logger.info('GitHub installation ID lookup complete')
}

void main()
