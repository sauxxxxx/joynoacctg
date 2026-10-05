import { randomBytes } from 'node:crypto'
import { ApiFailure } from '../../http/errors.js'
import { hashPassword, verifyPassword } from '../../security/passwords.js'
import { createSession, revokeSession } from '../../security/session.js'
import { activeMemberships, findUser } from './authRepository.js'

const fallbackHash = hashPassword(randomBytes(32).toString('hex'))

export async function signIn(db, credentials) {
  const identifier = credentials.username.trim()
  const user = findUser(db, identifier)
  const validPassword = await verifyPassword(credentials.password, user?.password_hash ?? await fallbackHash)
  if (!user || !validPassword) {
    throw new ApiFailure('UNAUTHENTICATED', 401, 'The username or password is incorrect.')
  }
  if (!user.active) throw new ApiFailure('FORBIDDEN', 403, 'This account is inactive.')

  const rows = activeMemberships(db, user.id)
  if (!rows.length) throw new ApiFailure('FORBIDDEN', 403, 'This account has no active company membership.')
  const session = createSession(db, user.id)
  return {
    ...session,
    user: { id: user.id, username: user.username, email: user.email, name: user.name, active: true },
    memberships: rows.map((row) => ({
      companyId: row.company_id, companyName: row.company_name, role: row.role,
      permissions: JSON.parse(row.permissions_json),
    })),
  }
}

export function signOut(db, token) {
  revokeSession(db, token)
}
