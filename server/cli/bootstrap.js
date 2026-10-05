import { randomUUID } from 'node:crypto'
import { openDatabase } from '../db/connection.js'
import { hashPassword } from '../security/passwords.js'
import { administratorPermissions } from '../security/permissions.js'

const username = process.env.JOYNO_ADMIN_USERNAME?.trim()
const password = process.env.JOYNO_ADMIN_PASSWORD ?? ''
const companyName = process.env.JOYNO_COMPANY_NAME?.trim()
if (!username || username.length > 254 || !companyName || companyName.length > 120 || password.length < 12 || password.length > 128) {
  console.error('Set JOYNO_ADMIN_USERNAME (1–254 characters), JOYNO_ADMIN_PASSWORD (12–128 characters), and JOYNO_COMPANY_NAME (1–120 characters) before running api:bootstrap.')
  process.exitCode = 1
} else {
  const passwordHash = await hashPassword(password)
  const db = openDatabase()
  try {
    const companyId = randomUUID()
    const userId = randomUUID()
    const roleId = randomUUID()
    db.exec('BEGIN IMMEDIATE')
    try {
      if (db.prepare('SELECT id FROM users LIMIT 1').get()) throw new Error('Local database already has users; bootstrap runs only once.')
      db.prepare('INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)').run(companyId, companyName, new Date().toISOString())
      db.prepare('INSERT INTO users (id, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(userId, username, username, passwordHash, new Date().toISOString())
      db.prepare('INSERT INTO roles (id, company_id, name, permissions_json, system) VALUES (?, ?, ?, ?, 1)')
        .run(roleId, companyId, 'Administrator', JSON.stringify(administratorPermissions()))
      db.prepare('INSERT INTO company_memberships (id, company_id, user_id, role_id) VALUES (?, ?, ?, ?)')
        .run(randomUUID(), companyId, userId, roleId)
      db.exec('COMMIT')
      console.log(`Local company created: ${companyName} (${companyId}). Admin username: ${username}.`)
    } catch (error) { db.exec('ROLLBACK'); throw error }
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  } finally { db.close() }
}
