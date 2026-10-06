import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { ApiFailure } from '../../http/errors.js'
import { hashPassword } from '../../security/passwords.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { identityRepository } from './identityRepository.js'
import { roleSchema, userSchema } from './identitySchemas.js'

const invalid = (message) => new ApiFailure('VALIDATION_ERROR', 422, message)
const conflict = (message = 'This record changed. Reload before saving again.') => new ApiFailure('CONFLICT', 409, message)
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).default('') }).strict()

export async function requireAdministrator(db, companyId, userId) {
  const { rows } = await db.query(`SELECT r.id FROM company_memberships m JOIN roles r ON r.id = m.role_id AND r.company_id = m.company_id
    WHERE m.company_id = $1 AND m.user_id = $2 AND m.active = 1 AND r.active = 1 AND r.system = 1`, [companyId, userId])
  if (!rows.length) throw new ApiFailure('FORBIDDEN', 403, 'Only an administrator can manage user access.')
}

export function identityService(db, kind) {
  const repository = identityRepository(db)
  const roleKind = kind === 'roles'
  const entity = roleKind ? 'role' : 'user'
  async function requireRecord(tx, companyId, id) {
    const value = await identityRepository(tx)[entity](companyId, id)
    if (!value) throw new ApiFailure('NOT_FOUND', 404, 'Record not found.')
    return value
  }
  async function protectAdministrator(tx, context, previous, next) {
    if (!previous) return
    if (previous.id === context.userId && !next.active) throw invalid('You cannot deactivate your own account.')
    const membership = (await tx.query(`SELECT r.system FROM company_memberships m JOIN roles r ON r.id = m.role_id
      WHERE m.company_id = $1 AND m.user_id = $2`, [context.companyId, previous.id])).rows[0]
    const nextRole = await identityRepository(tx).role(context.companyId, next.roleId)
    if (previous.active && membership.system && (!next.active || !nextRole.system)) {
      const { rows } = await tx.query(`SELECT COUNT(*) AS count FROM company_memberships m JOIN users u ON u.id = m.user_id
        JOIN roles r ON r.id = m.role_id WHERE m.company_id = $1 AND m.active = 1 AND u.active = 1 AND r.active = 1 AND r.system = 1`, [context.companyId])
      if (Number(rows[0].count) <= 1) throw invalid('Keep at least one active administrator in the company.')
    }
    const memberships = (await tx.query('SELECT COUNT(*) AS count FROM company_memberships WHERE user_id = $1', [previous.id])).rows[0]
    if (Number(memberships.count) > 1) throw invalid('This user belongs to multiple companies. Contact the account owner to update their access.')
  }
  async function saveRole(tx, context, id, value, previous) {
    const duplicates = await identityRepository(tx).roles(context.companyId)
    if (duplicates.some((role) => role.id !== id && role.name.toLowerCase() === value.name.toLowerCase())) throw invalid('Another role has this name.')
    if (!previous && value.system) throw invalid('Built-in roles cannot be created here.')
    if (previous?.system && (value.name !== previous.name || !value.active || JSON.stringify(value.permissions) !== JSON.stringify(previous.permissions))) {
      throw invalid('The Administrator role and its permissions cannot be changed.')
    }
    if (previous && !value.active && (await tx.query('SELECT id FROM company_memberships WHERE company_id = $1 AND role_id = $2 LIMIT 1', [context.companyId, id])).rows.length) {
      throw invalid('Assign another role to its users before deactivating this role.')
    }
    if (previous) await tx.query('UPDATE roles SET name = $3, description = $4, permissions_json = $5, active = $6, version = version + 1 WHERE company_id = $1 AND id = $2',
      [context.companyId, id, value.name, value.description, JSON.stringify(value.permissions), Number(value.active)])
    else await tx.query('INSERT INTO roles (id, company_id, name, description, permissions_json, active, system) VALUES ($1, $2, $3, $4, $5, $6, 0)',
      [id, context.companyId, value.name, value.description, JSON.stringify(value.permissions), Number(value.active)])
    if (previous) await tx.query(`UPDATE sessions SET revoked_at = $1 WHERE user_id IN
      (SELECT user_id FROM company_memberships WHERE company_id = $2 AND role_id = $3)`, [new Date().toISOString(), context.companyId, id])
  }
  async function saveUser(tx, context, id, value, previous, passwordHash) {
    const role = await identityRepository(tx).role(context.companyId, value.roleId)
    if (!role?.active) throw invalid('Choose an active role in this company.')
    const duplicates = await tx.query(`SELECT id FROM users WHERE id <> $1 AND
      (lower(username) = lower($2) OR (email <> '' AND lower(email) = lower($3))
        OR (email <> '' AND lower(email) = lower($2)) OR ($3 <> '' AND lower(username) = lower($3)))`, [id, value.username, value.email])
    if (duplicates.rows.length) throw invalid('That username or email is unavailable.')
    await protectAdministrator(tx, context, previous, value)
    if (previous) {
      await tx.query('UPDATE users SET username = $2, email = $3, name = $4, active = $5, version = version + 1 WHERE id = $1', [id, value.username, value.email, value.name, Number(value.active)])
      await tx.query('UPDATE company_memberships SET role_id = $3, active = $4 WHERE company_id = $1 AND user_id = $2', [context.companyId, id, value.roleId, Number(value.active)])
      if (passwordHash) await tx.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, passwordHash])
      await tx.query('UPDATE sessions SET revoked_at = $2 WHERE user_id = $1', [id, new Date().toISOString()])
    } else {
      await tx.query('INSERT INTO users (id, username, email, name, password_hash, active, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [id, value.username, value.email, value.name, passwordHash, Number(value.active), new Date().toISOString()])
      await tx.query('INSERT INTO company_memberships (id, company_id, user_id, role_id, active) VALUES ($1, $2, $3, $4, $5)', [randomUUID(), context.companyId, id, value.roleId, Number(value.active)])
    }
  }
  return {
    async list(companyId, query) {
      const { page, pageSize, search } = querySchema.parse(query)
      const items = (await repository[kind](companyId)).filter((item) => [item.name, item.username, item.email, item.description].join(' ').toLowerCase().includes(search.toLowerCase()))
      return { data: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, totalPages: Math.max(1, Math.ceil(items.length / pageSize)) }
    },
    get: (companyId, id) => requireRecord(db, companyId, id),
    async save(context, id, body) {
      const { expectedVersion, ...input } = body
      const value = (roleKind ? roleSchema : userSchema).parse(input)
      if (!roleKind && !id && !value.password) throw invalid('Choose a password of 12–128 characters for the new user.')
      const passwordHash = !roleKind && value.password ? await hashPassword(value.password) : null
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        await requireAdministrator(tx, context.companyId, context.userId)
        if (!roleKind && id && tx.dialect === 'postgres') await tx.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [id])
        const previous = id ? await requireRecord(tx, context.companyId, id) : null
        if (previous && previous.version !== versionSchema.parse(expectedVersion)) throw conflict()
        const target = id || randomUUID()
        if (roleKind) await saveRole(tx, context, target, value, previous)
        else await saveUser(tx, context, target, value, previous, passwordHash)
        const saved = await requireRecord(tx, context.companyId, target)
        await appendAudit(tx, context, previous ? 'Updated' : 'Created', kind, target, previous, saved)
        return saved
      })
    },
    async remove(context, id, expectedVersion) {
      if (!roleKind) {
        const current = await requireRecord(db, context.companyId, id)
        const { id: _id, version: _version, ...input } = current
        return this.save(context, id, { ...input, active: false, expectedVersion })
      }
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        await requireAdministrator(tx, context.companyId, context.userId)
        const previous = await requireRecord(tx, context.companyId, id)
        if (previous.version !== versionSchema.parse(expectedVersion)) throw conflict()
        if (previous.system) throw invalid('The Administrator role cannot be deleted.')
        if ((await tx.query('SELECT id FROM company_memberships WHERE company_id = $1 AND role_id = $2 LIMIT 1', [context.companyId, id])).rows.length) throw conflict('This role is assigned to users. Assign another role first.')
        await tx.query('DELETE FROM roles WHERE company_id = $1 AND id = $2', [context.companyId, id])
        await appendAudit(tx, context, 'Deleted', kind, id, previous, null)
      })
    },
  }
}
