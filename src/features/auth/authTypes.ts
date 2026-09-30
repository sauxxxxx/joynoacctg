export interface AuthUser {
  id: string
  username: string
  email: string
  name: string
  role: string
  active: boolean
}

export interface AuthCredentials {
  username: string
  password: string
}

export interface AuthSession {
  user: AuthUser
  expiresAt: number
}

export interface AuthService {
  signIn(credentials: AuthCredentials): Promise<AuthUser>
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthenticationError'
  }
}
