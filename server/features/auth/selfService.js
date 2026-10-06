import { z } from 'zod'
import { ApiFailure } from '../../http/errors.js'
import { verifyPassword, hashPassword } from '../../security/passwords.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { activeMemberships } from './authRepository.js'

const shared = { expectedVersion: versionSchema, currentPassword: z.string().min(1).max(256) }
export const profileSchema = z.object({ ...shared, name: z.string().trim().min(1).max(120), email: z.union([z.literal(''), z.email().max(254)]) }).strict()
export const passwordSchema = z.object({ ...shared, newPassword: z.string().min(12).max(128) }).strict()
const publicProfile = (user) => ({ id: user.id, username: user.username, name: user.name, email: user.email, version: user.version })
const invalid = (message) => new ApiFailure('VALIDATION_ERROR', 422, message)

async function userRecord(db, userId, lock = false) {
  const row = (await db.query(`SELECT * FROM users WHERE id = $1${lock && db.dialect === 'postgres' ? ' FOR UPDATE' : ''}`, [userId])).rows[0]
  if (!row?.active) throw new ApiFailure('UNAUTHENTICATED', 401, 'Sign in to continue.')
  return row
}

export function selfService(db) {
  return {
    async profile(userId) { return publicProfile(await userRecord(db, userId)) },
    async update(context, body, passwordOnly = false) {
      const value = (passwordOnly ? passwordSchema : profileSchema).parse(body)
      // Derive outside the transaction; the current password is verified again under the user lock.
      const replacementHash = passwordOnly ? await hashPassword(value.newPassword) : null
      return db.transaction(async (tx) => {
        const previous = await userRecord(tx, context.userId, true)
        if (previous.version !== value.expectedVersion) throw new ApiFailure('CONFLICT', 409, 'Your account changed. Reload before saving.')
        if (!await verifyPassword(value.currentPassword, previous.password_hash)) throw invalid('The current password is incorrect.')
        if (passwordOnly && await verifyPassword(value.newPassword, previous.password_hash)) throw invalid('Choose a password different from your current password.')
        if (!passwordOnly && value.email && (await tx.query(`SELECT id FROM users WHERE id <> $1 AND (lower(email) = lower($2) OR lower(username) = lower($2))`, [context.userId, value.email])).rows.length) throw invalid('That email is unavailable.')
        const result = passwordOnly
          ? await tx.query('UPDATE users SET password_hash = $2, version = version + 1 WHERE id = $1 AND version = $3', [context.userId, replacementHash, value.expectedVersion])
          : await tx.query('UPDATE users SET name = $2, email = $3, version = version + 1 WHERE id = $1 AND version = $4', [context.userId, value.name, value.email, value.expectedVersion])
        if (result.rowCount !== 1) throw new ApiFailure('CONFLICT', 409, 'Your account changed. Reload before saving.')
        await tx.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1 AND revoked_at IS NULL', [context.userId, new Date().toISOString()])
        const saved = publicProfile(await userRecord(tx, context.userId))
        const memberships = await activeMemberships(tx, context.userId)
        for (const row of memberships) await appendAudit(tx, { ...context, companyId: row.company_id }, passwordOnly ? 'Password changed' : 'Updated', passwordOnly ? 'self-password' : 'self-profile', context.userId,
          passwordOnly ? { username: previous.username, version: previous.version } : publicProfile(previous),
          passwordOnly ? { username: saved.username, version: saved.version } : saved)
        return { ...saved, signedOut: true }
      })
    },
  }
}
