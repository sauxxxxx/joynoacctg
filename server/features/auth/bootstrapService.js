import { randomUUID } from 'node:crypto'
import { hashPassword } from '../../security/passwords.js'
import { administratorPermissions } from '../../security/permissions.js'

export async function bootstrapAdministrator(db, { username, password, companyName }) {
  if (!username || username.length > 254 || !companyName || companyName.length > 120 || password.length < 12 || password.length > 128) {
    throw new Error('Set JOYNO_ADMIN_USERNAME (1–254 characters), JOYNO_ADMIN_PASSWORD (12–128 characters), and JOYNO_COMPANY_NAME (1–120 characters) before running api:bootstrap.')
  }
  const passwordHash = await hashPassword(password)
  return db.transaction(async (tx) => {
    if (tx.dialect === 'postgres') await tx.query('LOCK TABLE users IN EXCLUSIVE MODE')
    if ((await tx.query('SELECT id FROM users LIMIT 1')).rows.length) {
      throw new Error('Database already has users; bootstrap runs only once.')
    }
    const companyId = randomUUID()
    const userId = randomUUID()
    const roleId = randomUUID()
    const createdAt = new Date().toISOString()
    await tx.query('INSERT INTO companies (id, name, created_at) VALUES ($1, $2, $3)', [companyId, companyName, createdAt])
    await tx.query('INSERT INTO users (id, username, name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, username, passwordHash, createdAt])
    await tx.query('INSERT INTO roles (id, company_id, name, permissions_json, system) VALUES ($1, $2, $3, $4, 1)',
      [roleId, companyId, 'Administrator', JSON.stringify(administratorPermissions())])
    await tx.query('INSERT INTO company_memberships (id, company_id, user_id, role_id) VALUES ($1, $2, $3, $4)',
      [randomUUID(), companyId, userId, roleId])
    return { companyId, userId }
  })
}
