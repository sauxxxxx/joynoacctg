import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { hashPassword, verifyPassword, needsPasswordUpgrade } from '../security/passwords.js'

test('stronger scrypt hashes preserve legacy verification and reject unsupported work factors', async () => {
  const password = 'disposable-password-123'
  const salt = randomBytes(16)
  const legacy = `scrypt:${salt.toString('base64')}:${scryptSync(password, salt, 64).toString('base64')}`
  assert.equal(await verifyPassword(password, legacy), true)
  assert.equal(needsPasswordUpgrade(legacy), true)
  const current = await hashPassword(password)
  assert.equal(needsPasswordUpgrade(current), false)
  assert.equal(await verifyPassword(password, current), true)
  assert.equal(await verifyPassword('incorrect-password', current), false)
  assert.equal(await verifyPassword(password, current.replace('32768', '99999999')), false)
  assert.equal(await verifyPassword(password, 'malformed'), false)
})
