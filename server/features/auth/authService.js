import { randomBytes } from 'node:crypto'
import { ApiFailure } from '../../http/errors.js'
import { hashPassword, verifyPassword, needsPasswordUpgrade } from '../../security/passwords.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { createSession, revokeSession } from '../../security/session.js'
import { activeMemberships, findUser } from './authRepository.js'

const fallbackHash = hashPassword(randomBytes(32).toString('hex'))

export async function signIn(db, credentials, requestId = 'sign-in') {
  const identifier = credentials.username.trim()
  const user = await findUser(db, identifier)
  const validPassword = await verifyPassword(credentials.password, user?.password_hash ?? await fallbackHash)
  if (!user || !validPassword) {
    throw new ApiFailure('UNAUTHENTICATED', 401, 'The username or password is incorrect.')
  }
  if (!user.active) throw new ApiFailure('FORBIDDEN', 403, 'This account is inactive.')
  const upgraded = needsPasswordUpgrade(user.password_hash) && credentials.password.length >= 12 && credentials.password.length <= 128 ? await hashPassword(credentials.password) : null

  return db.transaction(async (tx) => {
    const current = (await tx.query(`SELECT * FROM users WHERE id = $1${tx.dialect === 'postgres' ? ' FOR UPDATE' : ''}`, [user.id])).rows[0]
    if (!current?.active || current.password_hash !== user.password_hash) throw new ApiFailure('UNAUTHENTICATED', 401, 'Your account changed. Sign in again.')
    const rows = await activeMemberships(tx, user.id)
    if (!rows.length) throw new ApiFailure('FORBIDDEN', 403, 'This account has no active company membership.')
    if (upgraded) {
      await tx.query('UPDATE users SET password_hash = $2 WHERE id = $1', [current.id, upgraded])
      for (const row of rows) await appendAudit(tx, { companyId: row.company_id, userId: current.id, requestId }, 'Protection upgraded', 'self-password', current.id, null, { username: current.username })
    }
    const session = await createSession(tx, user.id)
    return {
      ...session,
      user: { id: current.id, username: current.username, email: current.email, name: current.name, active: true },
      memberships: rows.map((row) => ({ companyId: row.company_id, companyName: row.company_name, role: row.role, permissions: JSON.parse(row.permissions_json) })),
    }
  })
}

export function signOut(db, token) {
  return revokeSession(db, token)
}
