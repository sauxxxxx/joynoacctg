import test from 'node:test'
import assert from 'node:assert/strict'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { postgresFixture } from './postgresFixture.js'
import { createApp } from '../app.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { administratorPermissions } from '../security/permissions.js'

test('company settings, access administration, tenant isolation and password redaction', async (t) => {
  const db = await postgresFixture(t)
  const password = 'company-test-password-123'
  const { companyId, userId } = await bootstrapAdministrator(db, { username: 'admin', password, companyName: 'Company Test' })
  const server = createApp(db).listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const base = `http://127.0.0.1:${server.address().port}/api/v1`
  let token
  async function request(path, method = 'GET', body) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { status: response.status, body: response.status === 204 ? null : await response.json() }
  }
  token = (await request('/auth/sign-in', 'POST', { username: 'admin', password })).body.data.accessToken
  const root = `/companies/${companyId}`
  const profile = (await request(`${root}/settings/profile`)).body.data
  assert.equal(profile.companyName, 'Company Test')
  assert.equal(profile.version, 0)
  const { version, ...input } = profile
  const saved = await request(`${root}/settings/profile`, 'PUT', { ...input, companyName: 'Updated company', expectedVersion: version })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.data.version, 1)
  assert.equal((await request(`${root}/settings/profile`, 'PUT', { ...input, expectedVersion: 0 })).status, 409)
  assert.equal((await request(`/companies/${randomUUID()}/settings/profile`)).status, 404)
  const adminRole = (await request(`${root}/roles`)).body.data[0]
  const permissions = administratorPermissions()
  for (const module of Object.keys(permissions)) permissions[module] = { view: true, create: false, edit: false, delete: false }
  const viewerRole = await request(`${root}/roles`, 'POST', { name: 'Viewer', description: '', active: true, system: false, permissions })
  assert.equal(viewerRole.status, 201)
  const created = await request(`${root}/company/user`, 'POST', { username: 'viewer', email: '', name: 'Viewer', roleId: viewerRole.body.data.id, active: true, password })
  assert.equal(created.status, 201)
  assert.equal('password' in created.body.data, false)
  assert.equal('password_hash' in created.body.data, false)
  assert.equal((await request(`${root}/roles/${adminRole.id}`, 'DELETE')).status, 422)
  const admin = (await request(`${root}/company/user/${userId}`)).body.data
  const { id: _id, version: adminVersion, ...adminInput } = admin
  assert.equal((await request(`${root}/company/user/${userId}`, 'PATCH', { ...adminInput, roleId: viewerRole.body.data.id, expectedVersion: adminVersion })).status, 422)
  const viewerToken = (await request('/auth/sign-in', 'POST', { username: 'viewer', password })).body.data.accessToken
  const { id: viewerId, version: viewerVersion, ...viewerInput } = created.body.data
  assert.equal((await request(`${root}/company/user/${viewerId}`, 'PATCH', { ...viewerInput, active: false, expectedVersion: viewerVersion })).status, 200)
  token = viewerToken
  assert.equal((await request(`${root}/roles`)).status, 401)
  token = (await request('/auth/sign-in', 'POST', { username: 'admin', password })).body.data.accessToken
  const audits = (await request(`${root}/audit-events`)).body.data
  assert.ok(audits.length >= 3)
  assert.equal(JSON.stringify((await db.query('SELECT before_json, after_json FROM audit_events')).rows).includes(password), false)
  const owner = await request(`${root}/company/owner`, 'POST', { firstName: 'Jane', middleName: '', lastName: 'Doe', suffix: '', tin: '', email: '', address: '', active: true })
  assert.equal(owner.status, 201)
  assert.equal((await request(`${root}/company/owner/${owner.body.data.id}?expectedVersion=1`, 'DELETE')).status, 204)
})
