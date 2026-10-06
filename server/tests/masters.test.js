import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: master records validate relationships, protect references and switch defaults atomically`, async (t) => {
  const { request, root, createAccount } = await httpFixture(t, dialect)
  const customer = { customerType: 'Company', name: 'First customer', tradeName: '', isDefault: true, active: true, unitBuilding: '', locality: '', country: 'Philippines', zipCode: '', tin: '', lineOfBusiness: '', withholding: false, topWithholdingAgent: false, contactPerson: '', email: '', phone: '', fax: '' }
  const first = await request(root + '/customers', 'POST', customer)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const second = await request(root + '/customers', 'POST', { ...customer, name: 'Second customer' })
  assert.equal(second.status, 201, JSON.stringify(second.body))
  const all = (await request(root + '/customers')).body.data
  assert.equal(all.filter((item) => item.isDefault).length, 1)
  assert.equal(all.find((item) => item.id === first.body.data.id).version, 2)
  assert.equal((await request(`/companies/${randomUUID()}/customers/${second.body.data.id}`)).status, 404)
  assert.equal((await request(root + '/customers', 'POST', { ...customer, active: false })).status, 422)
  assert.equal((await request(root + '/customers', 'POST', customer)).status, 422)
  const asset = await createAccount('BANK', 'Asset')
  const bankInput = { name: 'Company', bank: 'Bank', accountNumber: '123456', ledgerAccountId: asset.code, remarks: '', active: true }
  const bank = await request(root + '/bank-accounts', 'POST', bankInput)
  assert.equal(bank.status, 201, JSON.stringify(bank.body))
  assert.equal(bank.body.data.ledgerAccountId, asset.id)
  assert.equal((await request(root + '/bank-accounts', 'POST', { ...bankInput, accountNumber: '654321' })).status, 201)
  assert.equal((await request(root + '/bank-accounts', 'POST', { ...bankInput, name: 'Other name' })).status, 422)
  assert.equal((await request(root + '/bank-accounts?active=true&sortBy=name')).body.total, 2)
  assert.equal((await request(`${root}/accounts/${asset.id}?expectedVersion=1`, 'DELETE')).status, 409)
  const vendorInput = { kind: 'vendors', name: 'Test vendor', tin: '', address: '', accountId: '', active: true, computation: 'Amount', rate: 0, allowOverride: false, payments: 1, frequency: '', dueOn: 0, paymentDue: 'Days' }
  const vendor = (await request(root + '/purchase-setup', 'POST', vendorInput)).body.data
  const fixedAsset = { salesInvoice: '', trackingNumber: 'ASSET-1', datePurchased: '2026-10-06', description: 'Machine', vendorId: vendor.id, itemId: '', purchasePriceCents: 100000, vatCents: 0, usefulLifeMonths: 60, salvageValueCents: 10000, remarks: '', lapsedMonths: 0, warrantyExpirationDate: '' }
  assert.equal((await request(root + '/fixed-assets', 'POST', { ...fixedAsset, vendorId: randomUUID() })).status, 422)
  assert.equal((await request(root + '/fixed-assets', 'POST', { ...fixedAsset, salvageValueCents: 200000 })).status, 422)
  const saved = await request(root + '/fixed-assets', 'POST', fixedAsset)
  assert.equal(saved.status, 201, JSON.stringify(saved.body))
  assert.equal((await request(`${root}/purchase-setup/${vendor.id}?expectedVersion=1`, 'DELETE')).status, 409)
  assert.equal((await request(`${root}/fixed-assets/${saved.body.data.id}?expectedVersion=1`, 'DELETE')).status, 204)
  assert.equal((await request(`${root}/purchase-setup/${vendor.id}?expectedVersion=1`, 'DELETE')).status, 204)
})
