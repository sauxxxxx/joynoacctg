import { createHash, randomBytes } from 'node:crypto'
import { config } from '../config.js'

export function tokenHash(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function createSession(db, userId) {
  const accessToken = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + config.sessionHours * 60 * 60 * 1000).toISOString()
  db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash(accessToken), userId, expiresAt)
  return { accessToken, expiresAt }
}

export function revokeSession(db, token) {
  db.prepare('UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL')
    .run(new Date().toISOString(), tokenHash(token))
}
