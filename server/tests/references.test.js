import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { administratorPermissions } from '../security/permissions.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: workflow lookups are read-only, tenant-scoped and do not expose vendor details`, async (t) => {
  const { request, root, password, createAccount } = await httpFixture(t, dialect)
  const cash = await createAccount('BANK', 'Asset')
  const vendor = { kind: 'vendors', name: 'Restricted lookup vendor', tin: '123-456', address: 'Private address', accountId: '', active: true, computation: 'Amount', rate: 0, allowOverride: false, payments: 1, frequency: '', dueOn: 0, paymentDue: 'Days' }
  assert.equal((await request(root + '/purchase-setup', 'POST', vendor)).status, 201)
  const permissions = administratorPermissions()
  for (const module of Object.keys(permissions)) permissions[module] = { view: false, create: false, edit: false, delete: false }
  permissions['Asset Management'].view = true
  const role = (await request(root + '/roles', 'POST', { name: 'Asset viewer', description: '', active: true, system: false, permissions })).body.data
  assert.equal((await request(root + '/company/user', 'POST', { username: 'asset-viewer', name: 'Asset viewer', roleId: role.id, email: '', active: true, password })).status, 201)
  const token = (await request('/auth/sign-in', 'POST', { username: 'asset-viewer', password })).body.data.accessToken
  assert.equal((await request(root + '/accounts', 'GET', undefined, token)).status, 403)
  assert.equal((await request(root + '/purchase-setup', 'GET', undefined, token)).status, 403)
  const accounts = await request(root + '/reference-data/accounts', 'GET', undefined, token)
  assert.equal(accounts.status, 200, JSON.stringify(accounts.body))
  assert.equal(accounts.body.data[0].id, cash.id)
  const vendors = await request(root + '/reference-data/vendors', 'GET', undefined, token)
  assert.equal(vendors.status, 200)
  assert.equal(vendors.body.data[0].name, vendor.name)
  assert.equal(vendors.body.data[0].tin, undefined)
  assert.equal(vendors.body.data[0].address, undefined)
  assert.equal((await request(root + '/reference-data/goods', 'GET', undefined, token)).status, 200)
  assert.equal((await request(`/companies/${randomUUID()}/reference-data/accounts`, 'GET', undefined, token)).status, 404)
  assert.equal((await request(root + '/reference-data/vendors', 'POST', vendor, token)).status, 404)
  assert.equal((await request(root + '/reference-data/vendors?arbitrary=true', 'GET', undefined, token)).status, 422)
})
