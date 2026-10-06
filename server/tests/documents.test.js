import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { documentPosting } from '../features/transactions/documentPosting.js'
import { lineTotal, percentageOf } from '../features/transactions/documentMath.js'

const snapshot = { customerType: 'Company', company: '', tin: '', street: '', locality: '', country: '', zipCode: '' }
const line = { id: '', itemId: '', description: 'Services', quantity: 1.5, unitPriceCents: 10001, withholdingTaxCode: '', withholdingTaxCents: 0, vatCode: '', vatType: '', vatCents: 123, creditableVatCents: 0 }
const setup = (kind, name) => ({ kind, name, active: true, accountId: '', payments: 1, dueOn: 1, paymentDue: 'Months', frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false })
const sales = (customerId, termId) => ({ kind: 'sales-invoices', number: 'SI-1', date: '2026-01-31', customerId, status: 'Unpaid', paymentTermId: termId, paymentMethodId: '', dueDate: '', amountCents: 1, remarks: '', customerDetails: snapshot, discountTypeId: '', discountRate: 0, discountAmountCents: 0, lines: [line], payments: [], withInvoice: false, journalEntryId: '' })
const editable = ({ id: _id, version, ...record }) => ({ ...record, expectedVersion: version })

test('money arithmetic uses exact centavos and rejects excessive rate precision', () => {
  assert.equal(lineTotal(line), 15002)
  assert.equal(percentageOf(15002, 12.5), 1875)
  assert.throws(() => percentageOf(15002, 0.0000001), /decimal places/)
})

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: sales and purchasing sources validate, post atomically, protect allocations and preserve void history`, async (t) => {
  const api = await httpFixture(t, dialect)
  const { request, root, db, companyId, userId } = api
  async function create(path, input) {
    const result = await request(root + path, 'POST', input)
    assert.equal(result.status, 201, JSON.stringify(result.body))
    return result.body.data
  }
  const ar = await api.createAccount('AR', 'Asset')
  const cash = await api.createAccount('CASH', 'Asset')
  const revenue = await api.createAccount('REVENUE', 'Revenue')
  const expense = await api.createAccount('EXPENSE', 'Expense')
  const ap = await api.createAccount('AP', 'Liability')
  const journalLines = (debit, credit, amount) => [{ accountId: debit, debitCents: amount, creditCents: 0 }, { accountId: credit, debitCents: 0, creditCents: amount }]
  const customer = await create('/customers', { customerType: 'Company', name: 'Customer', isDefault: false, active: true, zipCode: '', tin: '', withholding: false, topWithholdingAgent: false })
  const term = await create('/sales-setup', setup('sales-payment-terms', 'Monthly'))
  const method = await create('/sales-setup', setup('sales-payment-methods', 'Cash'))
  const input = sales(customer.id, term.id)
  const batchKey = randomUUID()
  const bulkRecords = [{ ...input, number: 'BULK-1', status: 'Draft' }, { ...input, number: 'BULK-2', status: 'Draft' }]
  assert.equal((await request(root + '/sales-documents/bulk', 'POST', { batchKey, documents: [bulkRecords[0], { ...bulkRecords[1], customerId: randomUUID() }] })).status, 422)
  assert.equal((await request(root + '/sales-documents')).body.total, 0)
  const bulk = await request(root + '/sales-documents/bulk', 'POST', { batchKey, documents: bulkRecords })
  assert.equal(bulk.status, 201, JSON.stringify(bulk.body))
  assert.deepEqual((await request(root + '/sales-documents/bulk', 'POST', { batchKey, documents: bulkRecords })).body.data.map((record) => record.id), bulk.body.data.map((record) => record.id))
  assert.equal((await request(root + '/sales-documents/bulk', 'POST', { batchKey, documents: [{ ...bulkRecords[0], number: 'CHANGED' }] })).status, 409)
  assert.equal((await request(root + '/sales-documents')).body.total, 2)
  assert.equal((await request(root + '/sales-documents', 'POST', { ...input, customerId: randomUUID() })).status, 422)
  assert.equal((await request(root + '/sales-documents', 'POST', { ...input, status: 'Posted' })).status, 409)
  assert.equal((await request(root + '/sales-documents', 'POST', { ...input, unexpected: true })).status, 422)
  const invoice = await create('/sales-documents', input)
  assert.equal(invoice.amountCents, 15125) // Server quantity rounding plus recorded VAT, never the submitted total.
  assert.equal(invoice.dueDate, '2026-02-28')
  assert.equal((await request(root + '/sales-documents', 'POST', input)).status, 422)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}`, 'PATCH', { ...editable(invoice), expectedVersion: 2 })).status, 409)
  const postBody = { expectedVersion: 1, lines: journalLines(ar.id, revenue.id, 15125) }
  assert.equal((await request(`${root}/sales-documents/${invoice.id}/post`, 'POST', { ...postBody, lines: journalLines(ar.id, revenue.id, 1) })).status, 422)
  const context = { companyId, userId, requestId: 'document-audit-failure' }
  const failing = { ...db, transaction: (operation) => db.transaction((tx) => operation({ ...tx, query(sql, values) { if (sql.includes('INSERT INTO audit_events')) throw new Error('Deliberate document audit failure'); return tx.query(sql, values) } })) }
  await assert.rejects(documentPosting(failing, 'sales-documents').post(context, invoice.id, postBody), /Deliberate document audit failure/)
  assert.equal((await request(root + '/journal-entries')).body.total, 0)
  const posted = await request(`${root}/sales-documents/${invoice.id}/post`, 'POST', postBody)
  assert.equal(posted.status, 200, JSON.stringify(posted.body))
  assert.equal(posted.body.data.version, 2)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}/post`, 'POST', postBody)).body.data.journalEntryId, posted.body.data.journalEntryId)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}/post`, 'POST', { ...postBody, lines: journalLines(cash.id, revenue.id, 15125) })).status, 409)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}`, 'PATCH', editable(posted.body.data))).status, 409)
  const receiptInput = { ...input, kind: 'sales-receipts', number: 'RC-1', date: '2026-02-28', status: 'Draft', paymentTermId: '', paymentMethodId: method.id, lines: [], payments: [{ id: '', invoiceId: invoice.id, others: '', amountCents: 15125 }], withInvoice: true }
  assert.equal((await request(root + '/sales-documents', 'POST', { ...receiptInput, payments: [{ ...receiptInput.payments[0], amountCents: 15126 }] })).status, 422)
  const receipt = await create('/sales-documents', receiptInput)
  const receipt2 = await create('/sales-documents', { ...receiptInput, number: 'RC-2' })
  const receiptPost = { expectedVersion: 1, lines: journalLines(cash.id, ar.id, 15125) }
  assert.equal((await request(`${root}/sales-documents/${receipt.id}/post`, 'POST', receiptPost)).status, 200)
  assert.equal((await request(`${root}/sales-documents/${receipt2.id}/post`, 'POST', receiptPost)).status, 422)
  const voidBody = { expectedVersion: 2, reason: 'Entered in error' }
  assert.equal((await request(`${root}/sales-documents/${invoice.id}/void`, 'POST', voidBody)).status, 409)
  assert.equal((await request(`${root}/sales-documents/${receipt.id}/void`, 'POST', { ...voidBody, reason: '' })).status, 422)
  assert.equal((await request(`${root}/sales-documents/${receipt.id}/void`, 'POST', voidBody)).status, 200)
  assert.equal((await request(`${root}/sales-documents/${receipt2.id}?expectedVersion=1`, 'DELETE')).status, 204)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}/void`, 'POST', voidBody)).status, 200)
  const sourceJournal = await request(`${root}/journal-entries/${posted.body.data.journalEntryId}`)
  assert.equal(sourceJournal.body.data.status, 'Voided')
  assert.equal(sourceJournal.body.data.lines.length, 2)
  assert.equal((await request(`${root}/sales-documents/${invoice.id}?expectedVersion=3`, 'DELETE')).status, 409)
  assert.equal((await request(`/companies/${randomUUID()}/sales-documents/${invoice.id}`)).status, 404)
  const vendor = await create('/purchase-setup', { kind: 'vendors', name: 'Vendor', tin: '', accountId: '', active: true, computation: 'Amount', rate: 0, allowOverride: false, payments: 1, frequency: '', dueOn: 0, paymentDue: 'Days' })
  const purchaseInput = { kind: 'purchase-invoices', number: 'PI-1', date: '2026-10-06', vendorId: vendor.id, amountCents: 1, totalCents: 1, paidCents: 9999, status: 'Draft', remarks: '', paymentMethod: '', paymentTerms: '', checkNumber: '', taxCents: 5, lines: [{ id: '', description: 'Expense', quantity: 1, unitPriceCents: 1000 }], month: '', year: '', period: '', payrollFrequency: '', payGroup: '', accrualJE: '', allocations: [], journalEntryId: '', dueDate: '' }
  const purchase = await create('/purchases', purchaseInput)
  assert.equal(purchase.totalCents, 1005)
  assert.equal(purchase.paidCents, 0)
  assert.equal((await request(`${root}/purchases/${purchase.id}/post`, 'POST', { expectedVersion: 1, lines: journalLines(expense.id, ap.id, 1005) })).status, 200)
  const payment = await create('/purchases', { ...purchaseInput, kind: 'cash-voucher', number: 'CV-1', amountCents: 1005, taxCents: 0, lines: [], allocations: [{ id: '', invoiceId: purchase.id, others: '', amountCents: 1005 }] })
  assert.equal((await request(`${root}/purchases/${payment.id}/post`, 'POST', { expectedVersion: 1, lines: journalLines(ap.id, cash.id, 1005) })).status, 200)
  assert.equal((await request(`${root}/purchases/${purchase.id}`)).body.data.paidCents, 1005)
  assert.equal((await request(`${root}/purchases/${purchase.id}/void`, 'POST', voidBody)).status, 409)
  assert.equal((await request(`${root}/purchases/${payment.id}/void`, 'POST', voidBody)).status, 200)
  assert.equal((await request(`${root}/purchases/${purchase.id}`)).body.data.paidCents, 0)
  assert.equal((await request(`${root}/purchases/${purchase.id}/void`, 'POST', voidBody)).status, 200)
})
