import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { postgresFixture } from './postgresFixture.js'
import { migratePostgres, requirePostgresSchema } from '../db/migratePostgres.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { createApp } from '../app.js'
import { tokenHash } from '../security/session.js'
import { accountService } from '../features/accounting/accountService.js'
import { grantRuntime } from '../db/grantRuntime.js'

const password = 'postgres-test-password-123'

test('PostgreSQL migrations are idempotent and reject checksum drift', async (t) => {
  const db = await postgresFixture(t)
  await migratePostgres(db)
  await requirePostgresSchema(db)
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM schema_migrations')).rows[0].count, 4)
  await db.query('UPDATE schema_migrations SET checksum = $1 WHERE version = 1', ['changed'])
  await assert.rejects(migratePostgres(db), /changed after application/)
  await assert.rejects(requirePostgresSchema(db), /does not match/)
})

test('PostgreSQL API supports auth, tenant permissions, CRUD, filtering, concurrency versions, and audit rollback', async (t) => {
  const db = await postgresFixture(t)
  const credentials = { username: 'admin', password, companyName: 'Joyno PostgreSQL Test' }
  const { companyId } = await bootstrapAdministrator(db, credentials)
  await assert.rejects(bootstrapAdministrator(db, credentials), /bootstrap runs only once/)
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/v1`
  let token
  async function request(path, method = 'GET', body) {
    const response = await fetch(`${base}${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    return { status: response.status, body: response.status === 204 ? null : await response.json() }
  }
  const categories = `/companies/${companyId}/account-categories`
  const accounts = `/companies/${companyId}/accounts`
  assert.equal((await request('/health')).body.data.database, 'postgres')
  assert.equal((await request(accounts)).status, 401)
  assert.equal((await request('/auth/sign-in', 'POST', { username: 'admin', password: 'wrong' })).status, 401)
  const session = (await request('/auth/sign-in', 'POST', { username: 'ADMIN', password })).body.data
  token = session.accessToken
  assert.equal(session.memberships[0].companyId, companyId)
  const root = await request(categories, 'POST', { code: 'ROOT', name: 'Cash %_ category', accountType: 'Asset' })
  assert.equal(root.status, 201)
  const input = { code: '101', name: 'Cash account', parentCode: 'ROOT', type: 'Asset' }
  const created = await request(accounts, 'POST', input)
  assert.equal(created.status, 201)
  assert.equal((await request(categories, 'POST', { code: 'ROOT', name: 'Duplicate' })).status, 422)
  const id = created.body.data.id
  assert.equal((await request(`${accounts}/${id}`, 'PATCH', { ...input, name: 'Updated', expectedVersion: 1 })).body.data.version, 2)
  assert.equal((await request(`${accounts}/${id}`, 'PATCH', { ...input, expectedVersion: 1 })).status, 409)
  assert.equal((await request(`${categories}/${root.body.data.id}?expectedVersion=1`, 'DELETE')).status, 409)
  assert.equal((await request(accounts, 'POST', { ...input, code: '102', parentCode: 'MISSING' })).status, 422)
  assert.equal((await request(`/companies/${randomUUID()}/accounts`)).status, 404)
  assert.equal((await request(`${categories}?search=%25_`)).body.total, 1)
  assert.equal((await request(`${categories}?search=CASH&active=true`)).body.total, 1)
  assert.equal((await request(`${categories}?sortBy=company_id`)).status, 422)
  assert.equal((await db.query('SELECT COUNT(*) AS count FROM audit_events')).rows[0].count, 3)
  // A nonexistent audit actor forces the service's entire mutation to roll back.
  await assert.rejects(accountService(db, 'categories').create(
    { companyId, userId: 'missing-actor', requestId: randomUUID() }, { code: 'ROLLBACK', name: 'Rollback' }),
  (error) => error.code === '23503')
  assert.equal((await db.query('SELECT id FROM account_categories WHERE code = $1', ['ROLLBACK'])).rows.length, 0)
  assert.equal((await request(`${accounts}/${id}?expectedVersion=2`, 'DELETE')).status, 204)
  const permissions = JSON.stringify({ Accounting: { view: true, create: false, edit: false, delete: false } })
  await db.query('UPDATE roles SET permissions_json = $1 WHERE company_id = $2', [permissions, companyId])
  assert.equal((await request(categories, 'POST', { code: 'DENIED', name: 'Denied' })).status, 403)
  assert.equal((await request('/auth/sign-out', 'POST')).status, 200)
  assert.equal((await request(accounts)).status, 401)
  token = (await request('/auth/sign-in', 'POST', { username: 'admin', password })).body.data.accessToken
  await db.query('UPDATE sessions SET expires_at = $1 WHERE token_hash = $2', ['2000-01-01T00:00:00.000Z', tokenHash(token)])
  assert.equal((await request(accounts)).body.error.code, 'SESSION_EXPIRED')
})

test('PostgreSQL runtime role cannot change schema, migrations, or existing audits', async (t) => {
  const db = await postgresFixture(t)
  await db.query('CREATE ROLE joyno_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE')
  await db.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
  await grantRuntime(db, 'joyno_app')
  await assert.rejects(grantRuntime(db, 'unsafe;role'), /role name/)
  await db.query('SET ROLE joyno_app')
  try {
    await requirePostgresSchema(db)
    await bootstrapAdministrator(db, { username: 'runtime-admin', password, companyName: 'Restricted runtime' })
    assert.equal((await db.query('SELECT COUNT(*) AS count FROM users')).rows[0].count, 1)
    for (const statement of [
      'CREATE TABLE forbidden (id INTEGER)', 'DELETE FROM audit_events',
      'UPDATE audit_events SET action = action', 'DELETE FROM schema_migrations',
    ]) await assert.rejects(db.query(statement), (error) => error.code === '42501')
  } finally { await db.query('RESET ROLE') }
})
