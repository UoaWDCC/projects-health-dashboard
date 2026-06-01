export type ProjectMemberPerson = {
  id: string
  displayName: string
  imageUrl: string | null
  createdAt: Date
}

export type ProjectMemberWithPerson = {
  id: string
  projectId: string
  personId: string
  displayName: string | null
  isActive: boolean
  joinedAt: Date
  person: ProjectMemberPerson
}

export type ProjectMemberLinkedResponse = {
  outcome: 'member_linked'
  member: ProjectMemberWithPerson
}

export type ProjectMemberAlreadyExistsResponse = {
  outcome: 'already_member'
  message: string
}

// This type is used to handle the case where a member being added already exists as an active member of the project.
// In that case, we skip adding them and show a message to the user when adding on new member page.
export type AddProjectMemberResponse =
  | ProjectMemberLinkedResponse
  | ProjectMemberAlreadyExistsResponse
