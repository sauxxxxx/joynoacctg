import { once } from 'node:events'
import assert from 'node:assert/strict'
import { createApp } from '../app.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { postgresFixture } from './postgresFixture.js'
import { openDatabase } from '../db/connection.js'
import { asBackend } from '../db/backend.js'

export async function httpFixture(t, dialect = 'postgres') {
  let db
  if (dialect === 'sqlite') {
    const sqlite = openDatabase(':memory:')
    t.after(() => sqlite.close())
    db = asBackend(sqlite)
  } else db = await postgresFixture(t)
  const password = 'disposable-test-password-123'
  const { companyId, userId } = await bootstrapAdministrator(db, { username: 'admin', password, companyName: 'Disposable Test' })
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/v1`
  let token
  async function request(path, method = 'GET', body, accessToken = token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: response.status === 204 ? null : await response.json() }
  }
  token = (await request('/auth/sign-in', 'POST', { username: 'admin', password })).body.data.accessToken
  const root = `/companies/${companyId}`
  async function createAccount(code, type, active = true) {
    const category = await request(`${root}/account-categories`, 'POST', { code: `${type.toUpperCase()}-ROOT`, name: type, accountType: type })
    assert.ok([201, 422].includes(category.status), JSON.stringify(category.body))
    const result = await request(`${root}/accounts`, 'POST', { code, name: code, parentCode: `${type.toUpperCase()}-ROOT`, type, active })
    assert.equal(result.status, 201, JSON.stringify(result.body))
    return result.body.data
  }
  return { db, root, request, createAccount, companyId, userId, password, base, token }
}
