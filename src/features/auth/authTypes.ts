import type { PermissionMatrix } from '../company/companyStore'

export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  role: string
  active: boolean
  /** Permissions for the active company membership, as returned by the server. Preview users resolve them from Company › Roles. */
  permissions?: PermissionMatrix
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthSession {
  user: AuthUser
  expiresAt: number
  /** Bearer token for API requests. Empty in preview mode. */
  accessToken: string
  companyId: string
}

export interface AuthService {
  signIn(credentials: AuthCredentials): Promise<AuthSession>
  signOut(session: AuthSession): Promise<void>
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
