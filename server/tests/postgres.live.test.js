import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { postgresAdapter } from '../db/postgresAdapter.js'
import { migratePostgres } from '../db/migratePostgres.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { accountService } from '../features/accounting/accountService.js'
import { journalService } from '../features/accounting/journalService.js'
import { settingsService } from '../features/company/settingsService.js'
import { taxService } from '../features/government/taxService.js'
import { masterService } from '../features/records/masterService.js'
import { bankingService } from '../features/banking/bankingService.js'
import { documentService } from '../features/transactions/documentService.js'
import { documentPosting } from '../features/transactions/documentPosting.js'
import { privateDocumentService } from '../features/documents/documentService.js'
import { selfService } from '../features/auth/selfService.js'
import { companyRecordService } from '../features/company/recordService.js'
import { postedBooks } from '../features/government/booksRoutes.js'
import { config } from '../config.js'

const url = process.env.JOYNO_TEST_DATABASE_URL
const explicitlyEnabled = process.env.JOYNO_ALLOW_NATIVE_TESTS === '1' && process.env.NODE_ENV === 'test' && config.databaseDriver === 'postgres'
const connection = url ? { connectionString: url } : { host: config.databaseHost, port: config.databasePort, database: config.databaseName, user: config.databaseUser, password: config.databasePassword }

test('native PostgreSQL pool serializes edits, protects journals and persists settings/tax records', { skip: !url && !explicitlyEnabled }, async (t) => {
  // Create/remove only this uniquely named test schema. Never truncate existing data.
  const schema = `joyno_test_${randomUUID().replaceAll('-', '')}`
  const owner = new pg.Pool({ ...connection, max: 1 })
  let pool
  t.after(async () => {
    if (pool) await pool.end()
    if (!/^joyno_test_[0-9a-f]{32}$/.test(schema)) throw new Error('Unsafe test schema name.')
    try { await owner.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`) } finally { await owner.end() }
  })
  await owner.query(`CREATE SCHEMA "${schema}"`)
  pool = new pg.Pool({ ...connection, max: 4, options: `-c search_path=${schema}` })
  const db = postgresAdapter(pool)
  await migratePostgres(db)
  const { companyId, userId } = await bootstrapAdministrator(db, {
    username: 'test-admin', password: 'disposable-test-password-123', companyName: 'Disposable test company',
  })
  const context = { companyId, userId, requestId: randomUUID() }
  const service = accountService(db, 'categories')
  const record = await service.create(context, { code: 'ROOT', name: 'Root' })
  const results = await Promise.allSettled([
    service.update(context, record.id, { code: 'ROOT', name: 'First edit', expectedVersion: 1 }),
    service.update(context, record.id, { code: 'ROOT', name: 'Second edit', expectedVersion: 1 }),
  ])
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'CONFLICT')
  assert.equal((await service.get(companyId, record.id)).version, 2)
  await assert.rejects(service.create({ ...context, userId: 'missing-actor' }, { code: 'ROLLBACK', name: 'Rollback' }))
  assert.equal((await db.query('SELECT id FROM account_categories WHERE code = $1', ['ROLLBACK'])).rows.length, 0)
  assert.equal(Number((await db.query('SELECT COUNT(*) AS count FROM audit_events')).rows[0].count), 2)
  const accounts = accountService(db, 'accounts')
  const cash = await accounts.create(context, { code: 'CASH', name: 'Cash', parentCode: 'ROOT', type: 'Asset' })
  const revenue = await accounts.create(context, { code: 'SALES', name: 'Sales', parentCode: 'ROOT', type: 'Revenue' })
  const journals = journalService(db)
  const draft = { kind: 'general-journal', date: '2026-10-06', lines: [
    { accountId: cash.id, debitCents: 12345, creditCents: 0 }, { accountId: revenue.id, debitCents: 0, creditCents: 12345 },
  ] }
  const entry = await journals.save(context, null, draft)
  const postResults = await Promise.allSettled([journals.transition(context, entry.id, { expectedVersion: 1 }, 'post'), journals.transition(context, entry.id, { expectedVersion: 1 }, 'post')])
  assert.equal(postResults.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal((await journals.get(companyId, entry.id)).status, 'Posted')
  await assert.rejects(journals.save(context, entry.id, { ...draft, expectedVersion: 2 }), (error) => error.code === 'INVALID_STATE_TRANSITION')
  const settings = settingsService(db)
  const { version, ...profile } = await settings.load(companyId, 'profile')
  await settings.save(context, 'profile', { ...profile, companyName: 'Updated disposable company', expectedVersion: version })
  assert.equal((await settings.load(companyId, 'profile')).companyName, 'Updated disposable company')
  const taxes = taxService(db, 'tax-forms')
  const tax = await taxes.save(context, null, { formId: 'form-0619e', year: 2026, period: 'October', status: 'Draft', taxDueCents: 12345, dueDate: '2026-11-10', entry: '', amendment: false })
  assert.equal((await taxes.get(companyId, tax.id)).taxDueCents, 12345)
  await taxes.remove(context, tax.id, 1)
  const banks = masterService(db, 'bank-accounts')
  const bank = await banks.save(context, null, { name: 'Disposable bank', bank: '', accountNumber: 'TEST', ledgerAccountId: cash.id, remarks: '', active: true })
  const transactions = bankingService(db)
  const transaction = await transactions.save(context, null, { date: '2026-10-06', bankAccountId: bank.id, direction: 'Receipt', purpose: 'Native pool test', partyType: 'Other', party: '', amountCents: 12345, status: 'Draft', ledgerAccountId: revenue.id, reference: '', description: '', journalEntryId: '' })
  const postedSources = await Promise.all([
    transactions.createJournals(context, { sourceIds: [transaction.id] }),
    transactions.createJournals(context, { sourceIds: [transaction.id] }),
  ])
  assert.equal(postedSources.reduce((sum, result) => sum + result.created, 0), 1)
  assert.equal(postedSources.reduce((sum, result) => sum + result.existing, 0), 1)
  const journalized = await transactions.get(companyId, transaction.id)
  assert.equal(journalized.status, 'Journalized')
  await transactions.voidTransaction(context, transaction.id, { expectedVersion: journalized.version })
  assert.equal((await journals.get(companyId, journalized.journalEntryId)).status, 'Voided')
  const customer = await masterService(db, 'customers').save(context, null, { customerType: 'Company', name: 'Native customer', isDefault: false, active: true, zipCode: '', tin: '', withholding: false, topWithholdingAgent: false })
  const salesSetup = masterService(db, 'sales-setup')
  const setup = { name: 'Native', active: true, accountId: '', payments: 1, dueOn: 0, paymentDue: 'Days', frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false }
  const term = await salesSetup.save(context, null, { ...setup, kind: 'sales-payment-terms' })
  const method = await salesSetup.save(context, null, { ...setup, kind: 'sales-payment-methods' })
  const documents = documentService(db, 'sales-documents')
  const posting = documentPosting(db, 'sales-documents')
  const input = { kind: 'sales-invoices', number: 'NATIVE-1', date: '2026-10-06', customerId: customer.id, status: 'Unpaid', paymentTermId: term.id, customerDetails: { customerType: 'Company', company: '', tin: '', street: '', locality: '', country: '', zipCode: '' }, lines: [{ description: 'Native sale', quantity: 1, unitPriceCents: 10000, withholdingTaxCents: 0, vatCents: 0, creditableVatCents: 0 }], payments: [], withInvoice: false }
  const invoice = await documents.save(context, null, input)
  const review = { expectedVersion: 1, lines: [{ accountId: cash.id, debitCents: 10000, creditCents: 0 }, { accountId: revenue.id, debitCents: 0, creditCents: 10000 }] }
  const postedInvoices = await Promise.all([posting.post(context, invoice.id, review), posting.post(context, invoice.id, review)])
  assert.equal(postedInvoices[0].journalEntryId, postedInvoices[1].journalEntryId)
  const receiptInput = { ...input, kind: 'sales-receipts', status: 'Draft', paymentTermId: '', paymentMethodId: method.id, lines: [], payments: [{ invoiceId: invoice.id, amountCents: 10000 }] }
  const firstReceipt = await documents.save(context, null, { ...receiptInput, number: 'NATIVE-R1' })
  const secondReceipt = await documents.save(context, null, { ...receiptInput, number: 'NATIVE-R2' })
  const receiptResults = await Promise.allSettled([posting.post(context, firstReceipt.id, review), posting.post(context, secondReceipt.id, review)])
  assert.equal(receiptResults.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(receiptResults.find((result) => result.status === 'rejected').reason.code, 'VALIDATION_ERROR')
  const files = privateDocumentService(db)
  const bytes = Buffer.from('%PDF-1.7\nDisposable native file\n%%EOF')
  const metadata = Buffer.from(JSON.stringify({ name: 'Native file', fileName: 'native.pdf', size: bytes.length, category: 'Other' })).toString('base64')
  const file = await files.upload(context, metadata, bytes)
  assert.deepEqual((await files.content(companyId, file.id)).bytes, bytes)
  const archiveResults = await Promise.allSettled([files.archive(context, file.id, 1), files.archive(context, file.id, 1)])
  assert.equal(archiveResults.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(archiveResults.find((result) => result.status === 'rejected').reason.code, 'CONFLICT')
  const self = selfService(db)
  const own = await self.profile(userId)
  const passwordResults = await Promise.allSettled([
    self.update(context, { currentPassword: 'disposable-test-password-123', newPassword: 'native-new-password-123', expectedVersion: own.version }, true),
    self.update(context, { currentPassword: 'disposable-test-password-123', newPassword: 'native-other-password-123', expectedVersion: own.version }, true),
  ])
  assert.equal(passwordResults.filter((result) => result.status === 'fulfilled').length, 1)
  assert.equal(passwordResults.find((result) => result.status === 'rejected').reason.code, 'CONFLICT')
  const series = companyRecordService(db, 'series')
  await series.save(context, null, { documentType: 'Sales invoice', prefix: 'AUTO-', suffix: '', nextNumber: 1, padding: 4, resetFrequency: 'Never', active: true })
  const numbered = await Promise.all(Array.from({ length: 4 }, () => documents.save(context, null, { ...input, number: '' })))
  assert.deepEqual(numbered.map((record) => record.number).sort(), ['AUTO-0001', 'AUTO-0002', 'AUTO-0003', 'AUTO-0004'])
  const books = await postedBooks(db, companyId, { from: '2026-10-01', to: '2026-10-31', sortBy: 'debitCents' })
  assert.equal(books.total, 3)
  assert.equal(books.data.reduce((sum, row) => sum + row.debitCents, 0), 32345)
})
