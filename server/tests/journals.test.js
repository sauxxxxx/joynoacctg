import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { journalService } from '../features/accounting/journalService.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: journal validation, posting, voiding, concurrency and atomic batches`, async (t) => {
  const api = await httpFixture(t, dialect)
  const { request, root, db } = api
  const cash = await api.createAccount('CASH', 'Asset')
  const revenue = await api.createAccount('SALES', 'Revenue')
  const inactive = await api.createAccount('INACTIVE', 'Asset', false)
  const draft = {
    kind: 'general-journal', date: '2026-10-06', referenceNumber: 'INV_100%', party: 'Customer', remarks: 'Test sale',
    lines: [{ accountId: cash.id, debitCents: 12345, creditCents: 0 }, { accountId: revenue.id, debitCents: 0, creditCents: 12345 }],
  }
  const create = (value = draft) => request(`${root}/journal-entries`, 'POST', value)
  assert.equal((await create({ ...draft, lines: [{ ...draft.lines[0], creditCents: 1 }, draft.lines[1]] })).status, 422)
  assert.equal((await create({ ...draft, lines: [draft.lines[0], { ...draft.lines[1], creditCents: 1 }] })).status, 422)
  assert.equal((await create({ ...draft, lines: [{ ...draft.lines[0], accountId: inactive.id }, draft.lines[1]] })).status, 422)
  assert.equal((await create({ ...draft, lines: [{ ...draft.lines[0], accountId: randomUUID() }, draft.lines[1]] })).status, 422)
  assert.equal((await create({ ...draft, status: 'Posted' })).status, 422)
  assert.equal((await create({ ...draft, sourceKey: 'invented-source' })).status, 422)
  const first = await create({ ...draft, amountCents: 1, journalNumber: '999', createdBy: 'Impersonated' })
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const entry = first.body.data
  assert.equal(entry.amountCents, 12345)
  assert.equal(entry.journalNumber, '1')
  assert.notEqual(entry.createdBy, 'Impersonated')
  const path = `${root}/journal-entries/${entry.id}`
  assert.equal((await request(`/companies/${randomUUID()}/journal-entries/${entry.id}`)).status, 404)
  assert.equal((await request(path, 'PATCH', { ...draft })).status, 422)
  assert.equal((await request(path, 'PATCH', { ...draft, expectedVersion: true })).status, 422)
  assert.equal((await request(path, 'PATCH', { ...draft, expectedVersion: 2 })).status, 409)
  const list = await request(`${root}/journal-entries?search=INV_100%25&pageSize=1`)
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.equal(list.body.total, 1)
  assert.equal((await request(`${root}/journal-entries?search=INV_100X`)).body.total, 0)
  assert.equal((await request(`${root}/dashboard`)).body.data.revenueCents, 0)
  const second = (await create({ ...draft, referenceNumber: 'Second' })).body.data
  const failedBatch = await request(`${root}/journal-entries/transition`, 'POST', { action: 'post', entries: [{ id: entry.id, expectedVersion: 1 }, { id: second.id, expectedVersion: 99 }] })
  assert.equal(failedBatch.status, 409)
  assert.equal((await request(path)).body.data.status, 'Draft')
  assert.equal(Number((await db.query("SELECT COUNT(*) AS count FROM audit_events WHERE action = 'Posted'")).rows[0].count), 0)
  const context = { companyId: api.companyId, userId: api.userId, requestId: 'rollback-test' }
  const auditFailure = { ...db, transaction: (operation) => db.transaction((tx) => operation({ ...tx, query(sql, values) {
    if (sql.includes('INSERT INTO audit_events')) throw new Error('Deliberate audit failure')
    return tx.query(sql, values)
  } })) }
  await assert.rejects(() => journalService(auditFailure).transition(context, entry.id, { expectedVersion: 1 }, 'post'), /Deliberate audit failure/)
  assert.equal((await request(path)).body.data.status, 'Draft')
  const posted = await request(path + '/post', 'POST', { expectedVersion: 1 })
  assert.equal(posted.status, 200, JSON.stringify(posted.body))
  assert.equal(posted.body.data.version, 2)
  assert.equal((await request(path + '/post', 'POST', { expectedVersion: 2 })).status, 409)
  assert.equal((await request(path, 'PATCH', { ...draft, expectedVersion: 2 })).status, 409)
  assert.equal((await request(path + '?expectedVersion=2', 'DELETE')).status, 409)
  assert.equal((await request(`${root}/accounts/${cash.id}?expectedVersion=1`, 'DELETE')).status, 409)
  const dashboard = (await request(`${root}/dashboard`)).body.data
  assert.equal(dashboard.revenueCents, 12345)
  assert.equal(dashboard.bankBalanceCents, null)
  const voided = await request(path + '/void', 'POST', { expectedVersion: 2 })
  assert.equal(voided.status, 200)
  assert.equal(voided.body.data.lines.length, 2)
  assert.equal((await request(`${root}/dashboard`)).body.data.revenueCents, 0)
  const closing = await request(`${root}/settings/recording`, 'PUT', { journalUsage: 'All invoices', closeMonth: '10', closeYear: '2026', closingEntries: [], expectedVersion: 0 })
  assert.equal(closing.status, 200, JSON.stringify(closing.body))
  assert.equal((await create()).status, 409)
  assert.equal((await request(`${root}/journal-entries/${second.id}/post`, 'POST', { expectedVersion: 1 })).status, 409)
  assert.equal((await request(`${root}/journal-entries/${second.id}?expectedVersion=1`, 'DELETE')).status, 409)
  assert.equal((await create({ ...draft, date: '2026-11-01' })).status, 201)
})
