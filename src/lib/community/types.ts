/** Who is acting. Service functions take an actor explicitly; they never trust ids sent by a browser. */
export type MemberActor = {
  kind: 'member'
  id: string
  handle: string
  displayName: string
  email: string
  status: 'active' | 'suspended' | 'deleted'
  trusted: boolean
}

export type StaffActor = {
  kind: 'staff'
  id: string
  name: string
  canModerate: boolean
  isAdministrator: boolean
}

export type Actor = MemberActor | StaffActor | { kind: 'system' }

/** What the public may know about a member. Never the email, preferences or account state details. */
export type PublicAuthor = {
  handle: string | null
  displayName: string
  experience?: string
  /** False for deleted accounts: the name is shown but there is no profile to link to. */
  hasProfile: boolean
}

export type Page<T> = { items: T[]; page: number; totalPages: number; total: number }
