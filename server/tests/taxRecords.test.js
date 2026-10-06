import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { administratorPermissions } from '../security/permissions.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: tax record tracking, period uniqueness, permissions and tenant isolation`, async (t) => {
  const { request, root, password } = await httpFixture(t, dialect)
  const input = { formId: 'form-0619e', year: 2026, period: 'October', status: 'Draft', taxDueCents: 12345, dueDate: '2026-11-10', entry: '', amendment: false }
  assert.equal((await request(root + '/tax-forms', 'POST', { ...input, period: '1st Quarter' })).status, 422)
  assert.equal((await request(root + '/tax-forms', 'POST', { ...input, taxDueCents: 1.5 })).status, 422)
  assert.equal((await request(root + '/tax-forms', 'POST', { ...input, extra: 'unvalidated' })).status, 422)
  const saved = await request(root + '/tax-forms', 'POST', input)
  assert.equal(saved.status, 201, JSON.stringify(saved.body))
  const record = saved.body.data
  assert.equal(record.version, 1)
  assert.equal((await request(root + '/tax-forms', 'POST', input)).status, 422)
  assert.equal((await request(`/companies/${randomUUID()}/tax-forms/${record.id}`)).status, 404)
  assert.equal((await request(`${root}/tax-forms/${record.id}`, 'PATCH', { ...input, expectedVersion: 9 })).status, 409)
  assert.equal((await request(root + '/dashboard')).body.data.deadlines[0].dueDate, '2026-11-10')
  const filed = await request(`${root}/tax-forms/${record.id}`, 'PATCH', { ...input, status: 'Filed', expectedVersion: 1 })
  assert.equal(filed.status, 200)
  assert.equal(filed.body.data.version, 2)
  assert.equal((await request(root + '/dashboard')).body.data.deadlines.length, 0)
  assert.equal((await request(`${root}/tax-forms/${record.id}?expectedVersion=2`, 'DELETE')).status, 409)
  const annual = { formId: 'form-0605', year: 2026, status: 'Draft', amountCents: 50000, deadline: '2027-01-31', entry: '' }
  assert.equal((await request(root + '/yearly-tax-forms', 'POST', annual)).status, 201)
  assert.equal((await request(root + '/yearly-tax-forms', 'POST', annual)).status, 422)
  const certificate = { formId: 'form-2307', source: 'Other', party: '=untrusted', status: 'Draft', amountCents: 20000, date: '2026-10-06', fromDate: '2026-10-01', toDate: '2026-10-31', signedFile: 'External file reference', tin: '123-456-789' }
  assert.equal((await request(root + '/tax-certificates', 'POST', { ...certificate, fromDate: '2026-11-01' })).status, 422)
  const cert = (await request(root + '/tax-certificates', 'POST', certificate)).body.data
  assert.equal((await request(`${root}/tax-certificates/${cert.id}?expectedVersion=1`, 'DELETE')).status, 204)
  const permissions = administratorPermissions()
  permissions.Government = { view: false, create: false, edit: false, delete: false }
  const role = (await request(root + '/roles', 'POST', { name: 'No tax access', description: '', active: true, system: false, permissions })).body.data
  assert.equal((await request(root + '/company/user', 'POST', { username: 'restricted', name: 'Restricted user', roleId: role.id, email: '', active: true, password })).status, 201)
  const restricted = (await request('/auth/sign-in', 'POST', { username: 'restricted', password })).body.data.accessToken
  assert.equal((await request(root + '/tax-forms', 'GET', undefined, restricted)).status, 403)
  assert.equal((await request(root + '/tax-forms', 'POST', input, restricted)).status, 403)
  assert.equal((await request(root + '/dashboard', 'GET', undefined, restricted)).body.data.deadlines.length, 0)
  const audits = (await request(root + '/audit-events')).body.data
  assert.ok(audits.some((row) => row.module === 'Government' && row.reference === 'Tax return record: 0619E'))
})
