import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { bankingService } from '../features/banking/bankingService.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: bank source journals are atomic, idempotent, immutable and voided with their source`, async (t) => {
  const api = await httpFixture(t, dialect)
  const { request, root, db } = api
  const cash = await api.createAccount('BANK', 'Asset')
  const revenue = await api.createAccount('SALES', 'Revenue')
  const bank = (await request(root + '/bank-accounts', 'POST', { name: 'Company', bank: 'Bank', accountNumber: '123456', ledgerAccountId: cash.id, remarks: '', active: true })).body.data
  const input = { date: '2026-10-06', bankAccountId: bank.id, direction: 'Receipt', purpose: 'Receipt', partyType: 'Other', party: 'Customer', amountCents: 12345, status: 'Draft', ledgerAccountId: revenue.id, reference: 'BANK-1', description: '', journalEntryId: '' }
  assert.equal((await request(root + '/bank-transactions', 'POST', { ...input, ledgerAccountId: cash.id })).status, 422)
  assert.equal((await request(root + '/bank-transactions', 'POST', { ...input, bankAccountId: randomUUID() })).status, 422)
  assert.equal((await request(root + '/bank-transactions', 'POST', { ...input, status: 'Journalized' })).status, 409)
  assert.equal((await request(root + '/bank-transactions', 'POST', null)).status, 422)
  const transaction = (await request(root + '/bank-transactions', 'POST', input)).body.data
  const failed = await request(root + '/bank-transactions/create-journals', 'POST', { sourceIds: [transaction.id, randomUUID()] })
  assert.equal(failed.status, 404)
  assert.equal((await request(root + '/journal-entries')).body.total, 0)
  assert.equal((await request(`${root}/bank-transactions/${transaction.id}`)).body.data.status, 'Draft')
  const context = { companyId: api.companyId, userId: api.userId, requestId: 'bank-audit-test' }
  const failing = { ...db, transaction: (operation) => db.transaction((tx) => operation({ ...tx, query(sql, values) { if (sql.includes('INSERT INTO audit_events')) throw new Error('Deliberate bank audit failure'); return tx.query(sql, values) } })) }
  await assert.rejects(bankingService(failing).createJournals(context, { sourceIds: [transaction.id] }), /Deliberate bank audit failure/)
  assert.equal((await request(root + '/journal-entries')).body.total, 0)
  const result = await request(root + '/bank-transactions/create-journals', 'POST', { sourceIds: [transaction.id] })
  assert.equal(result.status, 200, JSON.stringify(result.body))
  assert.equal(result.body.data.created, 1)
  const again = (await request(root + '/bank-transactions/create-journals', 'POST', { sourceIds: [transaction.id] })).body.data
  assert.equal(again.created, 0)
  assert.equal(again.existing, 1)
  assert.equal(again.journalEntryIds[0], result.body.data.journalEntryIds[0])
  assert.equal((await request(root + '/dashboard')).body.data.revenueCents, 12345)
  assert.equal((await request(`${root}/bank-transactions/${transaction.id}`, 'PATCH', { ...input, expectedVersion: 2 })).status, 409)
  assert.equal((await request(`${root}/bank-transactions/${transaction.id}?expectedVersion=2`, 'DELETE')).status, 409)
  assert.equal((await request(`${root}/bank-accounts/${bank.id}?expectedVersion=1`, 'DELETE')).status, 409)
  const journalId = result.body.data.journalEntryIds[0]
  assert.equal((await request(`${root}/journal-entries/${journalId}/void`, 'POST', { expectedVersion: 1 })).status, 409)
  const voided = await request(`${root}/bank-transactions/${transaction.id}/void`, 'POST', { expectedVersion: 2 })
  assert.equal(voided.status, 200, JSON.stringify(voided.body))
  assert.equal(voided.body.data.status, 'Voided')
  assert.equal((await request(`${root}/journal-entries/${journalId}`)).body.data.lines.length, 2)
  assert.equal((await request(root + '/dashboard')).body.data.revenueCents, 0)
  assert.equal((await request(root + '/bank-transactions')).body.summary.amountCents, 0)
  assert.equal((await request(root + '/bank-transactions/create-journals', 'POST', { sourceIds: [transaction.id] })).status, 409)
  assert.equal((await request(root + '/bank-transactions?status=Draft')).body.total, 0)
  assert.equal((await request(`/companies/${randomUUID()}/bank-transactions/${transaction.id}`)).status, 404)
})
