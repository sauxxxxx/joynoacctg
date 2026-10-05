import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt)

export async function hashPassword(password) {
  if (password.length < 12 || password.length > 128) throw new Error('Admin password must be 12–128 characters.')
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, 64)
  return `scrypt:${salt.toString('base64')}:${key.toString('base64')}`
}

export async function verifyPassword(password, stored) {
  const [scheme, salt, encoded] = stored.split(':')
  if (scheme !== 'scrypt' || !salt || !encoded || password.length > 256) return false
  const expected = Buffer.from(encoded, 'base64')
  if (expected.length !== 64) return false
  const actual = await deriveKey(password, Buffer.from(salt, 'base64'), expected.length)
  return timingSafeEqual(actual, expected)
}
