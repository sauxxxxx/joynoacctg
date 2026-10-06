import test from 'node:test'
import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { documentService } from '../features/transactions/documentService.js'
import { masterService } from '../features/records/masterService.js'
import { settingsService } from '../features/company/settingsService.js'
import { signIn } from '../features/auth/authService.js'
import { needsPasswordUpgrade, verifyPassword } from '../security/passwords.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: fund references, logo/tax validation and legacy password upgrades are protected`, async (t) => {
  const api = await httpFixture(t, dialect)
  const context = { companyId: api.companyId, userId: api.userId, requestId: 'hardening-test' }
  const setup = masterService(api.db, 'purchase-setup')
  const base = { name: 'Fixture vendor', tin: '', address: '', accountId: '', active: true, computation: 'Amount', rate: 0, allowOverride: false, payments: 1, frequency: '', dueOn: 0, paymentDue: 'Days' }
  const vendor = await setup.save(context, null, { ...base, kind: 'vendors' })
  const custodian = await setup.save(context, null, { ...base, name: 'Fixture custodian', kind: 'revolving-fund-customers' })
  const input = { kind: 'petty-cash-voucher', number: 'FUND-1', date: '2026-10-06', vendorId: vendor.id, amountCents: 12345, status: 'Draft', taxCents: 0, lines: [], allocations: [], custodianId: custodian.id, fundMovement: 'Disbursement' }
  const documents = documentService(api.db, 'purchases')
  const saved = await documents.save(context, null, input)
  assert.equal(saved.totalCents, 12345)
  assert.equal(saved.custodianId, custodian.id)
  await assert.rejects(setup.remove(context, custodian.id, 1), (error) => error.code === 'CONFLICT')
  for (const invalid of [
    { custodianId: vendor.id }, { custodianId: 'foreign-custodian' }, { fundMovement: '' },
    { custodianId: '', fundMovement: 'Disbursement' },
    { fundMovement: 'Replenishment', allocations: [{ invoiceId: 'unused', amountCents: 1 }] },
    { kind: 'payrolls', month: '10', year: '2026' },
  ]) await assert.rejects(documents.save(context, null, { ...input, number: 'INVALID', ...invalid }), (error) => error.code === 'VALIDATION_ERROR')
  assert.equal(Number((await api.db.query('SELECT COUNT(*) AS count FROM company_records WHERE company_id = $1 AND kind = $2', [api.companyId, 'purchases'])).rows[0].count), 1)
  const settings = settingsService(api.db)
  const { version: profileVersion, ...profile } = await settings.load(api.companyId, 'profile')
  await assert.rejects(settings.save(context, 'profile', { ...profile, expectedVersion: profileVersion, logo: 'data:image/png;base64,' + Buffer.from('<html>not an image</html>').toString('base64') }))
  const { version: taxVersion, ...tax } = await settings.load(api.companyId, 'tax')
  await assert.rejects(settings.save(context, 'tax', { ...tax, expectedVersion: taxVersion, vat: { active: true, taxCode: '', startDate: '' } }))
  await assert.rejects(settings.save(context, 'tax', { ...tax, expectedVersion: taxVersion, availsTaxRelief: true, taxReliefDetails: '' }))
  const salt = randomBytes(16)
  const legacy = `scrypt:${salt.toString('base64')}:${scryptSync(api.password, salt, 64).toString('base64')}`
  await api.db.query('UPDATE users SET password_hash = $2 WHERE id = $1', [api.userId, legacy])
  await assert.rejects(signIn(api.db, { username: 'admin', password: 'incorrect-password' }))
  assert.equal((await api.db.query('SELECT password_hash FROM users WHERE id = $1', [api.userId])).rows[0].password_hash, legacy)
  await signIn(api.db, { username: 'admin', password: api.password }, 'upgrade-test')
  const upgraded = (await api.db.query('SELECT password_hash FROM users WHERE id = $1', [api.userId])).rows[0].password_hash
  assert.equal(needsPasswordUpgrade(upgraded), false)
  assert.equal(await verifyPassword(api.password, upgraded), true)
  const audits = JSON.stringify((await api.db.query('SELECT before_json, after_json FROM audit_events')).rows)
  assert.equal(audits.includes(api.password), false)
  assert.equal(audits.includes(upgraded), false)
})
