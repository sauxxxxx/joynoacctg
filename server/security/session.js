import { createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(db, userId) {
  const accessToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000).toISOString()
  await db.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)',
    [tokenHash(accessToken), userId, expiresAt])
  return { accessToken, expiresAt }
}

export async function revokeSession(db, token) {
  await db.query('UPDATE sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at IS NULL',
    [new Date().toISOString(), tokenHash(token)])
}
