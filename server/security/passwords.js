import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt)
// OWASP's 32 MiB scrypt profile balances memory use with stronger CPU cost.
const parameters = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }
export const needsPasswordUpgrade = (stored) => stored.split(':').length === 3

export async function hashPassword(password) {
  if (password.length < 12 || password.length > 128) throw new Error('Admin password must be 12–128 characters.')
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, 64, parameters)
  return `scrypt:32768:8:3:${salt.toString('base64')}:${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false
  const fields = stored.split(':')
  const legacy = fields.length === 3
  const [scheme] = fields
  const [salt, encoded] = fields.slice(-2)
  if (scheme !== 'scrypt' || !salt || !encoded || password.length > 256 || !legacy && (fields.length !== 6 || fields.slice(1, 4).join(':') !== '32768:8:3')) return false
  const saltBytes = Buffer.from(salt, 'base64')
  if (saltBytes.length !== 16) return false
  const expected = Buffer.from(encoded, 'base64')
  if (expected.length !== 64) return false
  const actual = await deriveKey(password, saltBytes, expected.length, legacy ? { N: 16384, r: 8, p: 1 } : parameters)
  return timingSafeEqual(actual, expected)
}
