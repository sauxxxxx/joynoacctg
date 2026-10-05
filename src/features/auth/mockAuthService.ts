import { AuthenticationError, type AuthCredentials, type AuthService, type AuthUser } from './authTypes'

export const previewCredentials: AuthCredentials = {
  username: 'john.phil',
  password: 'preview',
}

const previewUser: AuthUser = {
  id: 'preview-john-phil',
  username: previewCredentials.username,
  email: '',
  name: 'John Phil',
  role: 'Administrator',
  active: true,
}

const SESSION_DURATION = 8 * 60 * 60 * 1000

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds))
}

export const mockAuthService: AuthService = {
  async signIn(credentials) {
    await wait(450)
    const username = credentials.username.trim().toLocaleLowerCase()
    if (username !== previewCredentials.username || credentials.password !== previewCredentials.password) {
      throw new AuthenticationError('The username or password is incorrect. Use the preview account shown below.')
    }
    if (!previewUser.active) throw new AuthenticationError('This account is inactive. Contact your system administrator.')
    return { user: { ...previewUser }, expiresAt: Date.now() + SESSION_DURATION, accessToken: '', companyId: 'preview-company' }
  },
  async signOut() {},
}
