import test from 'node:test'
import assert from 'node:assert/strict'
import { httpFixture } from './httpFixture.js'
import { selfService } from '../features/auth/selfService.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: self-service verifies current password, versions, atomic audits and revokes all sessions`, async (t) => {
  const api = await httpFixture(t, dialect)
  const profile = (await api.request('/auth/me')).body.data
  assert.equal(profile.id, api.userId)
  assert.equal(profile.password_hash, undefined)
  const shared = { expectedVersion: profile.version, currentPassword: api.password }
  assert.equal((await api.request('/auth/me', 'PATCH', { ...shared, name: 'Changed', email: '', active: false })).status, 422)
  assert.equal((await api.request('/auth/change-password', 'POST', { ...shared, currentPassword: 'wrong', newPassword: 'new-disposable-password-123' })).status, 422)
  assert.equal((await api.request('/auth/change-password', 'POST', { ...shared, newPassword: api.password })).status, 422)
  assert.equal((await api.request('/auth/change-password', 'POST', { ...shared, newPassword: 'short' })).status, 422)
  assert.equal((await api.request('/auth/me', 'PATCH', { ...shared, expectedVersion: 99, name: 'Changed', email: '' })).status, 409)
  const failing = { ...api.db, transaction: (operation) => api.db.transaction((tx) => operation({ ...tx, query(sql, values) { if (sql.includes('INSERT INTO audit_events')) throw new Error('Deliberate account audit failure'); return tx.query(sql, values) } })) }
  await assert.rejects(selfService(failing).update({ userId: api.userId, requestId: 'self-test' }, { ...shared, newPassword: 'new-disposable-password-123' }, true), /Deliberate account audit failure/)
  assert.equal((await api.request('/auth/me')).status, 200)
  const secondToken = (await api.request('/auth/sign-in', 'POST', { username: 'admin', password: api.password })).body.data.accessToken
  const changed = await api.request('/auth/change-password', 'POST', { ...shared, newPassword: 'new-disposable-password-123' })
  assert.equal(changed.status, 200, JSON.stringify(changed.body))
  assert.equal(changed.body.data.signedOut, true)
  assert.equal((await api.request('/auth/me')).status, 401)
  assert.equal((await api.request('/auth/me', 'GET', undefined, secondToken)).status, 401)
  assert.equal((await api.request('/auth/sign-in', 'POST', { username: 'admin', password: api.password })).status, 401)
  const next = await api.request('/auth/sign-in', 'POST', { username: 'admin', password: 'new-disposable-password-123' })
  assert.equal(next.status, 200)
  const token = next.body.data.accessToken
  const updated = await api.request('/auth/me', 'PATCH', { expectedVersion: 2, currentPassword: 'new-disposable-password-123', name: 'New display name', email: 'private@example.test' }, token)
  assert.equal(updated.status, 200, JSON.stringify(updated.body))
  assert.equal(updated.body.data.name, 'New display name')
  assert.equal((await api.request('/auth/me', 'GET', undefined, token)).status, 401)
  const audit = (await api.db.query("SELECT before_json, after_json FROM audit_events WHERE entity_type = 'self-password'")).rows[0]
  assert.ok(audit)
  assert.ok(!JSON.stringify(audit).includes('password'))
  assert.ok(!JSON.stringify(audit).includes('scrypt:'))
})
