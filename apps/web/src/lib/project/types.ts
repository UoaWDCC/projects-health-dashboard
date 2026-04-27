export type Project = {
  id: string
  name: string
  slug: string
  description: string | null
  isActive: boolean
  imageUrl: string | null
  startedAt: string | null
  createdAt: string
  repositories: {
    id: string
    owner: string
    name: string
    installationId: string
  }[]
  channels: {
    id: string
    externalId: string
    name: string
  }[]
}
