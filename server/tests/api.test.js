import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { once } from 'node:events'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../app.js'
import { openDatabase } from '../db/connection.js'
import { hashPassword, verifyPassword } from '../security/passwords.js'
import { administratorPermissions, modules } from '../security/permissions.js'
import { tokenHash } from '../security/session.js'

const password = 'local-test-password-123'
const passwordHash = await hashPassword(password)

test('administrator bootstrap persists data, reopens migrations, and refuses a second setup', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'joyno-api-test-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const databasePath = join(directory, 'test.sqlite')
  const bootstrap = fileURLToPath(new URL('../cli/bootstrap.js', import.meta.url))
  const options = { encoding: 'utf8', env: { ...process.env,
    NODE_ENV: 'test', JOYNO_DB_DRIVER: 'sqlite',
    JOYNO_DB_PATH: databasePath, JOYNO_ADMIN_USERNAME: 'setup-test', JOYNO_ADMIN_PASSWORD: password, JOYNO_COMPANY_NAME: 'Setup test',
  } }
  const first = spawnSync(process.execPath, [bootstrap], options)
  assert.equal(first.status, 0, first.stderr)
  const second = spawnSync(process.execPath, [bootstrap], options)
  assert.equal(second.status, 1)
  assert.match(second.stderr, /bootstrap runs only once/)
  const db = openDatabase(databasePath)
  try {
    const user = db.prepare('SELECT * FROM users').get()
    assert.equal(user.username, 'setup-test')
    assert.notEqual(user.password_hash, password)
    assert.equal(await verifyPassword(password, user.password_hash), true)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM schema_migrations').get().count, 4)
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM company_memberships').get().count, 1)
  } finally { db.close() }
})

async function fixture(t) {
  const db = openDatabase(':memory:')
  const companyId = randomUUID()
  const otherCompanyId = randomUUID()
  for (const [id, name] of [[companyId, 'Joyno Test'], [otherCompanyId, 'Other Company']]) {
    db.prepare('INSERT INTO companies (id, name, created_at) VALUES (?, ?, ?)').run(id, name, new Date().toISOString())
  }
  for (const [username, company, permissions] of [
    ['admin', companyId, administratorPermissions()],
    ['viewer', companyId, Object.fromEntries(modules.map((module) => [module, { view: true, create: false, edit: false, delete: false }]))],
    ['other', otherCompanyId, administratorPermissions()],
  ]) {
    const userId = randomUUID()
    const roleId = randomUUID()
    db.prepare('INSERT INTO users (id, username, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(userId, username, username, passwordHash, new Date().toISOString())
    db.prepare('INSERT INTO roles (id, company_id, name, permissions_json) VALUES (?, ?, ?, ?)')
      .run(roleId, company, username, JSON.stringify(permissions))
    db.prepare('INSERT INTO company_memberships (id, company_id, user_id, role_id) VALUES (?, ?, ?, ?)')
      .run(randomUUID(), company, userId, roleId)
  }
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => { await new Promise((resolve) => server.close(resolve)); db.close() })
  const base = `http://127.0.0.1:${server.address().port}/api/v1`
  async function request(path, { method = 'GET', body, token, rawBody } = {}) {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    })
    const text = await response.text()
    return { status: response.status, body: text ? JSON.parse(text) : null, headers: response.headers }
  }
  async function login(username = 'admin') {
    const result = await request('/auth/sign-in', { method: 'POST', body: { username, password } })
    assert.equal(result.status, 200)
    return result.body.data.accessToken
  }
  const path = (resource, company = companyId) => `/companies/${company}/${resource}`
  return { db, request, login, path, companyId, otherCompanyId }
}

test('health, authentication failures, and malformed JSON use consistent envelopes', async (t) => {
  const api = await fixture(t)
  assert.equal((await api.request('/health')).body.data.status, 'ok')
  const documentation = await api.request('/openapi.json')
  assert.equal(documentation.body.openapi, '3.1.0')
  assert.ok(documentation.body.paths['/companies/{companyId}/accounts'])
  assert.equal((await api.request(api.path('accounts'))).status, 401)
  const invalid = await api.request('/auth/sign-in', { method: 'POST', body: { username: 'admin', password: 'wrong' } })
  assert.equal(invalid.body.error.code, 'UNAUTHENTICATED')
  assert.ok(invalid.body.error.requestId)
  const malformed = await api.request('/auth/sign-in', { method: 'POST', rawBody: '{broken' })
  assert.equal(malformed.status, 422)
  assert.equal(malformed.body.error.code, 'VALIDATION_ERROR')
})

test('sign-in returns the frontend contract and sign-out revokes the session', async (t) => {
  const api = await fixture(t)
  const signedIn = await api.request('/auth/sign-in', { method: 'POST', body: { username: 'ADMIN', password } })
  const session = signedIn.body.data
  assert.equal(session.user.username, 'admin')
  assert.equal(session.memberships[0].companyId, api.companyId)
  assert.equal(session.memberships[0].permissions.Accounting.create, true)
  assert.equal('password_hash' in session.user, false)
  assert.equal((await api.request('/auth/sign-out', { method: 'POST', token: session.accessToken })).status, 200)
  assert.equal((await api.request(api.path('accounts'), { token: session.accessToken })).status, 401)
})

test('expired sessions and deactivated users lose access server-side', async (t) => {
  const api = await fixture(t)
  const token = await api.login()
  api.db.prepare('UPDATE sessions SET expires_at = ? WHERE token_hash = ?').run('2000-01-01T00:00:00.000Z', tokenHash(token))
  const expired = await api.request(api.path('accounts'), { token })
  assert.equal(expired.body.error.code, 'SESSION_EXPIRED')
  const activeToken = await api.login()
  api.db.prepare("UPDATE users SET active = 0 WHERE username = 'admin'").run()
  assert.equal((await api.request(api.path('accounts'), { token: activeToken })).status, 401)
})

test('account CRUD calculates versions, rejects stale edits, and records audits atomically', async (t) => {
  const api = await fixture(t)
  const token = await api.login()
  const category = await api.request(api.path('account-categories'), { method: 'POST', token, body: { code: 'CCE', name: 'Cash', accountType: 'Asset' } })
  assert.equal(category.status, 201)
  const input = { code: '101', name: 'Cash account', parentCode: 'CCE', type: 'Asset' }
  const created = await api.request(api.path('accounts'), { method: 'POST', token, body: input })
  assert.equal(created.status, 201)
  const account = created.body.data
  assert.equal(account.version, 1)
  assert.match(account.id, /^[0-9a-f-]{36}$/)
  const updated = await api.request(api.path(`accounts/${account.id}`), { method: 'PATCH', token, body: { ...input, name: 'Updated cash', expectedVersion: 1 } })
  assert.equal(updated.body.data.version, 2)
  const stale = await api.request(api.path(`accounts/${account.id}`), { method: 'PATCH', token, body: { ...input, expectedVersion: 1 } })
  assert.equal(stale.status, 409)
  const invalid = await api.request(api.path('accounts'), { method: 'POST', token, body: { ...input, code: '102', parentCode: 'MISSING' } })
  assert.equal(invalid.status, 422)
  assert.ok(invalid.body.error.fieldErrors.parentCode)
  assert.equal(api.db.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1)
  assert.equal(api.db.prepare('SELECT COUNT(*) AS count FROM audit_events').get().count, 3)
  assert.equal((await api.request(api.path(`accounts/${account.id}?expectedVersion=2`), { method: 'DELETE', token })).status, 204)
  assert.equal((await api.request(api.path(`accounts/${account.id}`), { token })).status, 404)
})

test('companies and read-only roles cannot access or mutate another company records', async (t) => {
  const api = await fixture(t)
  const admin = await api.login()
  const created = await api.request(api.path('account-categories'), { method: 'POST', token: admin, body: { code: 'CUA', name: 'Current assets' } })
  assert.equal((await api.request(api.path('account-categories', api.otherCompanyId), { token: admin })).status, 404)
  const other = await api.login('other')
  assert.equal((await api.request(api.path(`account-categories/${created.body.data.id}`, api.otherCompanyId), { token: other })).status, 404)
  const viewer = await api.login('viewer')
  assert.equal((await api.request(api.path('account-categories'), { token: viewer })).status, 200)
  assert.equal((await api.request(api.path('account-categories'), { method: 'POST', token: viewer, body: { code: 'BAD', name: 'Denied' } })).status, 403)
})

test('categories reject hierarchy cycles and deletion while referenced', async (t) => {
  const api = await fixture(t)
  const token = await api.login()
  const root = (await api.request(api.path('account-categories'), { method: 'POST', token, body: { code: 'ROOT', name: 'Root' } })).body.data
  await api.request(api.path('account-categories'), { method: 'POST', token, body: { code: 'CHILD', name: 'Child', parentCode: 'ROOT' } })
  const cycle = await api.request(api.path(`account-categories/${root.id}`), { method: 'PATCH', token, body: { code: 'ROOT', name: 'Root', parentCode: 'CHILD', expectedVersion: 1 } })
  assert.equal(cycle.status, 422)
  assert.equal((await api.request(api.path(`account-categories/${root.id}?expectedVersion=1`), { method: 'DELETE', token })).status, 409)
  assert.equal(api.db.prepare('SELECT COUNT(*) AS count FROM audit_events').get().count, 2)
})

test('pagination is stable, filters work, and sort fields are allow-listed', async (t) => {
  const api = await fixture(t)
  const insert = api.db.prepare('INSERT INTO account_categories (id, company_id, code, name, active) VALUES (?, ?, ?, ?, ?)')
  for (let index = 0; index < 105; index += 1) insert.run(randomUUID(), api.companyId, String(index).padStart(3, '0'), `Category ${index}`, index % 2)
  const token = await api.login()
  const page = await api.request(api.path('account-categories?page=5&pageSize=25'), { token })
  assert.equal(page.body.data.length, 5)
  assert.equal(page.body.total, 105)
  assert.equal(page.body.data[0].code, '100')
  const empty = await api.request(api.path('account-categories?search=missing'), { token })
  assert.deepEqual(empty.body.data, [])
  assert.equal((await api.request(api.path('account-categories?active=true'), { token })).body.total, 52)
  assert.equal((await api.request(api.path('account-categories?sortBy=company_id'), { token })).status, 422)
})
