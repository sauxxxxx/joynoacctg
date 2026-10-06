import test from 'node:test'
import assert from 'node:assert/strict'
import { httpFixture } from './httpFixture.js'
import { documentService } from '../features/transactions/documentService.js'
import { companyRecordService } from '../features/company/recordService.js'
import { administratorPermissions } from '../security/permissions.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: numbered documents and posted reports preserve company scope, totals and template rules`, async (t) => {
  const api = await httpFixture(t, dialect)
  const context = { companyId: api.companyId, userId: api.userId, requestId: 'report-integration' }
  const cash = await api.createAccount('CASH', 'Asset')
  const revenue = await api.createAccount('SALES', 'Revenue')
  const customer = (await api.request(api.root + '/customers', 'POST', { customerType: 'Company', name: 'Report customer', active: true, isDefault: false, tin: '', zipCode: '', withholding: false, topWithholdingAgent: false })).body.data
  const term = (await api.request(api.root + '/sales-setup', 'POST', { kind: 'sales-payment-terms', name: 'Cash terms', active: true, accountId: '', payments: 1, dueOn: 0, paymentDue: 'Days', frequencyEvery: 0, frequencyUnit: '', computation: 'Amount', rate: 0, allowOverride: false })).body.data
  const series = { documentType: 'Sales invoice', prefix: 'INV-', suffix: '', nextNumber: 1, padding: 3, resetFrequency: 'Never', active: true }
  const seriesService = companyRecordService(api.db, 'series')
  const savedSeries = await seriesService.save(context, null, series)
  const input = { kind: 'sales-invoices', number: '', date: '2026-10-06', customerId: customer.id, status: 'Unpaid', paymentTermId: term.id, customerDetails: { customerType: 'Company', company: '', tin: '', street: '', locality: '', country: '', zipCode: '' }, lines: [{ description: 'Numbered sale', quantity: 1, unitPriceCents: 10000, withholdingTaxCents: 0, vatCents: 1200, creditableVatCents: 0 }], payments: [], withInvoice: false }
  const documents = documentService(api.db, 'sales-documents')
  await assert.rejects(documents.save(context, null, { ...input, lines: [] }))
  assert.equal((await seriesService.get(api.companyId, savedSeries.id)).nextNumber, 1)
  const first = await documents.save(context, null, input)
  const second = await documents.save(context, null, input)
  assert.equal(first.number, 'INV-001'); assert.equal(second.number, 'INV-002')
  assert.equal((await seriesService.get(api.companyId, savedSeries.id)).nextNumber, 3)
  await seriesService.save(context, savedSeries.id, { ...series, active: false, expectedVersion: 3 })
  await assert.rejects(seriesService.save(context, null, { ...series, resetFrequency: 'Monthly' }), /year token/)
  const monthlySeries = await seriesService.save(context, null, { ...series, resetFrequency: 'Monthly', prefix: 'INV-{YYYY}-{MM}-' })
  const october = await documents.save(context, null, input)
  const november = await documents.save(context, null, { ...input, date: '2026-11-01' })
  const backdated = await documents.save(context, null, input)
  assert.equal(october.number, 'INV-2026-10-001'); assert.equal(november.number, 'INV-2026-11-001'); assert.equal(backdated.number, 'INV-2026-10-002')
  assert.equal((await seriesService.get(api.companyId, monthlySeries.id)).nextNumber, 1)
  const posting = await api.request(`${api.root}/sales-documents/${first.id}/post`, 'POST', { expectedVersion: 1, lines: [{ accountId: cash.id, debitCents: 11200, creditCents: 0 }, { accountId: revenue.id, debitCents: 0, creditCents: 11200 }] })
  assert.equal(posting.status, 200, JSON.stringify(posting.body))
  const books = await api.request(api.root + '/posted-books?from=2026-10-01&to=2026-10-31&sortBy=debitCents')
  assert.equal(books.status, 200, JSON.stringify(books.body))
  assert.equal(books.body.total, 1); assert.equal(books.body.data[0].debitCents, 11200)
  assert.equal((await api.request(api.root + '/posted-books?from=2026-11-01&to=2026-10-01')).status, 422)
  assert.equal((await api.request(api.root + '/posted-books?sortBy=arbitrary')).status, 422)
  const template = { name: 'Trial balance template', report: 'Trial Balance', paperSize: 'A4', orientation: 'Landscape', headerText: 'Private report', footerText: 'Internal use', showSignatories: false, isDefault: true }
  assert.equal((await api.request(api.root + '/company/report%20template', 'POST', template)).status, 201)
  assert.equal((await api.request(api.root + '/company/report%20template', 'POST', { ...template, name: 'Duplicate default' })).status, 422)
  assert.equal((await api.request(api.root + '/report-context')).body.data.templates[0].headerText, 'Private report')
  const permissions = administratorPermissions()
  for (const module of Object.keys(permissions)) permissions[module] = { view: false, create: false, edit: false, delete: false }
  permissions.Government.view = true
  const role = (await api.request(api.root + '/roles', 'POST', { name: 'Government viewer', description: '', active: true, system: false, permissions })).body.data
  await api.request(api.root + '/company/user', 'POST', { username: 'gov-viewer', name: 'Government viewer', roleId: role.id, email: '', active: true, password: api.password })
  const token = (await api.request('/auth/sign-in', 'POST', { username: 'gov-viewer', password: api.password })).body.data.accessToken
  assert.equal((await api.request(api.root + '/journal-entries', 'GET', undefined, token)).status, 403)
  assert.equal((await api.request(api.root + '/posted-books', 'GET', undefined, token)).status, 200)
  assert.equal((await api.request(api.root + '/sales-report-context', 'GET', undefined, token)).status, 403)
  await api.request(`${api.root}/sales-documents/${first.id}/void`, 'POST', { expectedVersion: 2, reason: 'Cancelled source invoice' })
  assert.equal((await api.request(api.root + '/posted-books')).body.total, 0)
})
