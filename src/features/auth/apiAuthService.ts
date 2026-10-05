import type { EntityResponseDto, SignInResponseDto } from '../../contracts/dto'
import { ApiError } from '../../services/api/errors'
import { http } from '../../services/api/httpClient'
import type { PermissionMatrix } from '../company/companyStore'
import { AuthenticationError, type AuthService } from './authTypes'

/** Sign-in against `POST /api/v1/auth/sign-in`; see docs/BACKEND_SPEC.md › Authentication. */
export const apiAuthService: AuthService = {
  async signIn(credentials) {
    let response: SignInResponseDto
    try {
      response = (await http.post<EntityResponseDto<SignInResponseDto>>('/auth/sign-in', credentials, { tenant: false })).data
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'UNAUTHENTICATED' || error.code === 'VALIDATION_ERROR')) {
        throw new AuthenticationError('The username or password is incorrect.')
      }
      if (error instanceof ApiError && error.code === 'FORBIDDEN') throw new AuthenticationError('This account is inactive. Contact your system administrator.')
      throw error
    }
    const membership = response.memberships[0]
    if (!membership) throw new AuthenticationError('This account is not assigned to a company. Contact your system administrator.')
    const expiresAt = Date.parse(response.expiresAt)
    return {
      user: { ...response.user, role: membership.role, permissions: membership.permissions as PermissionMatrix },
      expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now(),
      accessToken: response.accessToken,
      companyId: membership.companyId,
    }
  },
  async signOut(session) {
    await http.post('/auth/sign-out', undefined, { tenant: false, accessToken: session.accessToken })
  },
}
