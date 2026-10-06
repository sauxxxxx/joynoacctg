import { z } from 'zod'
import { journalSchema, kinds } from '../features/accounting/journalSchemas.js'
import { settingsSchemas } from '../features/company/settingsSchemas.js'
import { recordSchemas } from '../features/company/recordSchemas.js'
import { roleSchema, userSchema } from '../features/company/identitySchemas.js'
import { taxSchemas } from '../features/government/taxSchemas.js'
import { masterSchemas, masterModules } from '../features/records/masterSchemas.js'
import { bankTransactionSchema, sourcesSchema } from '../features/banking/bankingSchemas.js'
import { documentSchemas } from '../features/transactions/documentSchemas.js'
import { postingSchema, voidSchema } from '../features/transactions/documentPosting.js'
import { bulkSchema } from '../features/transactions/documentBulk.js'

const json = (schema) => ({ 'application/json': { schema } })
const envelope = (schema) => ({ type: 'object', required: ['data', 'requestId'], properties: { data: schema, requestId: { type: 'string' } } })
const failures = Object.fromEntries([401, 403, 404, 409, 422].map((code) => [code, { description: 'Structured API error', content: json({ $ref: '#/components/schemas/Error' }) }]))
const company = { name: 'companyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
const version = { type: 'integer', minimum: 1 }
const body = (schema) => ({ required: true, content: json(schema) })
function schemaOf(schema) {
  const { $schema: _dialect, ...value } = z.toJSONSchema(schema, { io: 'input' })
  return value
}
const extend = (value, properties, required = []) => ({ ...value, properties: { ...value.properties, ...properties }, required: [...(value.required || []), ...required] })
const paginated = (record) => ({ type: 'object', required: ['data', 'page', 'pageSize', 'total', 'totalPages', 'requestId'], properties: {
  data: { type: 'array', items: record }, page: { type: 'integer' }, pageSize: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' }, requestId: { type: 'string' },
} })
const pagination = [
  { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
  { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 } },
  { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } },
]
function register(resource, tag, input, options = {}) {
  const path = `/companies/{companyId}/${resource}`
  const dtoInput = structuredClone(input)
  for (const field of options.privateFields || []) { delete dtoInput.properties[field]; dtoInput.required = dtoInput.required.filter((key) => key !== field) }
  const dto = extend(dtoInput, { id: { type: 'string', format: 'uuid' }, version }, ['id', 'version'])
  return {
    [path]: {
      parameters: [company],
      get: { tags: [tag], summary: `List ${resource}`, parameters: [...pagination, ...(options.filters || [])], responses: { 200: { description: 'Paginated records', content: json(paginated(dto)) }, ...failures } },
      post: { tags: [tag], summary: `Create ${resource} record`, description: options.description, requestBody: body(input), responses: { 201: { description: 'Created record', content: json(envelope(dto)) }, ...failures } },
    },
    [`${path}/{id}`]: {
      parameters: [company, id],
      get: { tags: [tag], summary: 'Get record', responses: { 200: { description: 'Record', content: json(envelope(dto)) }, ...failures } },
      patch: { tags: [tag], summary: 'Update record', description: options.description || 'Send the complete editable record and its current expectedVersion.',
        requestBody: body(extend(input, { expectedVersion: version }, ['expectedVersion'])), responses: { 200: { description: 'Saved record', content: json(envelope(dto)) }, ...failures } },
      delete: { tags: [tag], summary: 'Delete eligible record', parameters: [{ name: 'expectedVersion', in: 'query', required: true, schema: version }], responses: { 204: { description: 'Deleted' }, ...failures } },
    },
  }
}
const paths = {}
paths['/companies/{companyId}/sales-documents/bulk'] = { parameters: [company], post: {
  tags: ['Sales'], summary: 'Atomically save up to 100 draft invoices', description: 'Requires Sales create. A company-scoped UUID batchKey makes identical retries safe. Any invalid invoice or audit failure rolls back the whole batch; reusing the key with different data returns 409.',
  requestBody: body(schemaOf(bulkSchema)), responses: { 201: { description: 'Saved drafts', content: json(envelope({ type: 'array', items: { type: 'object' } })) }, ...failures },
} }
for (const [domain, schema] of Object.entries(documentSchemas)) {
  const tag = domain === 'sales-documents' ? 'Sales' : 'Purchases'
  Object.assign(paths, register(domain, tag, schemaOf(schema), { description: 'Server-calculated integer-centavo totals, tenant-scoped references and versioned changes. Sales total is subtotal less discount plus entered VAT; WTAX/CVAT are recorded metadata, not calculated deductions. Only eligible unposted records can be edited. Posted payment allocations determine invoice balances.' }))
  for (const [action, input] of [['post', postingSchema], ['void', voidSchema]]) paths[`/companies/{companyId}/${domain}/{id}/${action}`] = { parameters: [company, id], post: {
    tags: [tag], summary: `${action === 'post' ? 'Review and post' : 'Void'} source document and linked journal atomically`,
    description: action === 'post' ? 'Requires module edit plus Accounting create and edit. Reviewed active-account lines must balance to the exact document total. No legal tax treatment is inferred. Identical retries return the existing posting; stale or altered reviews fail. Acknowledgements are tracking records, not accounting postings.' : 'Requires module and Accounting edit, the current version, an open period and a reason. Related payment allocations must be removed or voided first. Original documents and journal lines remain available.',
    requestBody: body(schemaOf(input)), responses: { 200: { description: 'Updated document', content: json(envelope(extend(schemaOf(schema), { id: { type: 'string', format: 'uuid' }, version }, ['id', 'version']))) }, ...failures },
  } }
}
for (const kind of ['accounts', 'vendors', 'goods', 'catalog', 'series']) paths[`/companies/{companyId}/reference-data/${kind}`] = { parameters: [company], get: {
  tags: ['Reference data'], summary: `Read ${kind} choices for permitted workflows`, description: 'Read-only, tenant-scoped lookup. Access is granted only to modules that use these choices. Vendor details and accounting remarks are not exposed.',
  parameters: pagination.slice(0, 2), responses: { 200: { description: 'Paginated name and identifier choices', content: json(paginated({ type: 'object', properties: {
    id: { type: 'string', format: 'uuid' }, code: { type: 'string' }, name: { type: 'string' }, active: { type: 'boolean' },
  } })) }, ...failures },
} }
for (const [resource, schema] of Object.entries(masterSchemas)) Object.assign(paths, register(resource, masterModules[resource], schemaOf(schema), {
  description: 'Company-scoped, versioned master records. Referenced records cannot be deleted. Setting a default customer atomically clears the previous default.',
}))
Object.assign(paths, register('bank-transactions', 'Banking', schemaOf(bankTransactionSchema), {
  description: 'Only Draft transactions can be saved or deleted. Journalized and Voided records are read-only. Amounts are positive integer centavos; the bank cash and counterpart accounts must differ.',
  filters: [...['status', 'bankAccountId', 'from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))],
}))
paths['/companies/{companyId}/bank-transactions/create-journals'] = { parameters: [company], post: {
  tags: ['Banking'], summary: 'Create posted journals from bank transactions',
  description: 'Requires Banking edit plus Accounting create and edit. Atomic selection; retries return existing source journals without duplicate postings.',
  requestBody: body(schemaOf(sourcesSchema)), responses: { 200: { description: 'Created and existing counts with journal IDs', content: json(envelope({ type: 'object', required: ['created', 'existing', 'journalEntryIds'], properties: {
    created: { type: 'integer' }, existing: { type: 'integer' }, journalEntryIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
  } })) }, ...failures },
} }
paths['/companies/{companyId}/bank-transactions/{id}/void'] = { parameters: [company, id], post: {
  tags: ['Banking'], summary: 'Atomically void a bank transaction and its source journal',
  description: 'Requires Banking and Accounting edit. The open-period Journalized transaction must match expectedVersion. Original records and journal lines are preserved.',
  requestBody: body({ type: 'object', additionalProperties: false, required: ['expectedVersion'], properties: { expectedVersion: version } }),
  responses: { 200: { description: 'Voided bank transaction', content: json(envelope(extend(schemaOf(bankTransactionSchema), { id: { type: 'string', format: 'uuid' }, version }, ['id', 'version']))) }, ...failures },
} }
for (const [kind, schema] of Object.entries(recordSchemas)) Object.assign(paths, register(`company/${kind}`, 'Company', schemaOf(schema)))
for (const [kind, schema] of Object.entries(taxSchemas)) Object.assign(paths, register(kind, 'Government', schemaOf(schema), {
  description: 'Manual record tracking only. Filed, Received and Sent describe actions completed separately; this API does not calculate or submit official filings. Only drafts can be deleted.',
}))
Object.assign(paths, register('roles', 'Company', schemaOf(roleSchema), { description: 'Writes require the built-in administrator role. The system role cannot be deactivated, assigned users must be moved before deleting a role, and role changes revoke affected sessions.' }))
Object.assign(paths, register('company/user', 'Company', schemaOf(userSchema), { privateFields: ['password'], description: 'Administrator only for writes. Creation requires a new 12–128 character password; omit it on update to keep the password. Passwords are never returned or audited. Access changes revoke sessions. The last administrator cannot lose access. DELETE deactivates the user.' }))
for (const [kind, schema] of Object.entries(settingsSchemas)) {
  const value = schemaOf(schema)
  const dto = extend(value, { version: { type: 'integer', minimum: 0 } }, ['version'])
  paths[`/companies/{companyId}/settings/${kind}`] = { parameters: [company],
    get: { tags: ['Company'], summary: `Read ${kind} settings`, responses: { 200: { description: 'Saved settings or initial defaults at version 0', content: json(envelope(dto)) }, ...failures } },
    put: { tags: ['Company'], summary: `Save ${kind} settings`, requestBody: body(extend(value, { expectedVersion: { type: 'integer', minimum: 0 } }, ['expectedVersion'])), responses: { 200: { description: 'Saved settings with incremented version', content: json(envelope(dto)) }, ...failures } },
  }
}
const journalInput = schemaOf(journalSchema)
const journalDto = extend(journalInput, { id: { type: 'string', format: 'uuid' }, version }, ['id', 'version'])
Object.assign(paths, register('journal-entries', 'Accounting', journalInput, { description: 'Only general Draft entries can be saved here. Account lines must be active, positive, balanced and in an open period. Numbers, totals and creator are assigned by the server. Posted and source entries cannot be edited; voiding preserves their original lines.', filters: [
  { name: 'kind', in: 'query', schema: { type: 'string', enum: kinds } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['Draft', 'Posted', 'Voided'] } },
  ...['from', 'to'].map((name) => ({ name, in: 'query', schema: { type: 'string', format: 'date' } })),
  { name: 'sortBy', in: 'query', schema: { type: 'string', enum: ['date', 'journalNumber'], default: 'date' } },
  { name: 'sortDirection', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
] }))
for (const action of ['post', 'void']) paths[`/companies/{companyId}/journal-entries/{id}/${action}`] = { parameters: [company, id], post: {
  tags: ['Accounting'], summary: `${action} journal entry`, requestBody: body({ type: 'object', additionalProperties: false, required: ['expectedVersion'], properties: { expectedVersion: version } }),
  responses: { 200: { description: 'Journal with updated status and version', content: json(envelope(journalDto)) }, ...failures },
} }
paths['/companies/{companyId}/journal-entries/transition'] = { parameters: [company], post: {
  tags: ['Accounting'], summary: 'Atomically post or void a selection', description: 'All entries must have the expected version and eligible state. Any failure rolls back the complete selection and its audit events.',
  requestBody: body({ type: 'object', additionalProperties: false, required: ['action', 'entries'], properties: { action: { type: 'string', enum: ['post', 'void'] },
    entries: { type: 'array', minItems: 1, maxItems: 200, items: { type: 'object', additionalProperties: false, required: ['id', 'expectedVersion'], properties: { id: { type: 'string' }, expectedVersion: version } } } } }),
  responses: { 200: { description: 'Updated journals', content: json(envelope({ type: 'array', items: journalDto })) }, ...failures },
} }
paths['/companies/{companyId}/report-context'] = { parameters: [company], get: { tags: ['Accounting'], summary: 'Load company headers and reporting preferences', responses: {
  200: { description: 'Report context accessible with Accounting view permission', content: json(envelope({ type: 'object', properties: { profile: schemaOf(settingsSchemas.profile), reporting: schemaOf(settingsSchemas.reporting) } })) }, ...failures,
} } }
paths['/companies/{companyId}/dashboard'] = { parameters: [company], get: { tags: ['Accounting'], summary: 'Posted accounting overview and recorded tax deadlines', description: 'Amounts are integer centavos. Unconfigured Cash/AR/AP mappings return null, not invented balances. Tax deadlines are included only with Government view permission.', responses: {
  200: { description: 'Dashboard snapshot', content: json(envelope({ type: 'object', properties: {
    companyName: { type: 'string' }, sourceLabel: { type: 'string' },
    ...Object.fromEntries(['bankBalanceCents', 'receivablesCents', 'payablesCents'].map((key) => [key, { type: ['integer', 'null'] }])),
    revenueCents: { type: 'integer' }, expensesCents: { type: 'integer' }, unjournalizedCount: { type: 'integer', description: 'Draft journal count.' },
    trends: { type: 'array', items: { type: 'object' } }, deadlines: { type: 'array', items: { type: 'object' } }, activities: { type: 'array', items: { type: 'object' } },
  } })) }, ...failures,
} } }
paths['/companies/{companyId}/audit-events'] = { parameters: [company], get: { tags: ['Company'], summary: 'Read immutable audit history', description: 'Requires the built-in administrator role. No passwords or password hashes are returned.', parameters: pagination.slice(0, 2), responses: {
  200: { description: 'Paginated audit events', content: json(paginated({ type: 'object', properties: Object.fromEntries(['id', 'at', 'user', 'module', 'action', 'reference', 'details'].map((key) => [key, { type: 'string' }])) })) }, ...failures,
} } }
paths['/companies/{companyId}/posted-books'] = { parameters: [company], get: { tags: ['Government'], summary: 'Read and export posted journal book totals', description: 'Requires Government view. Excludes drafts and voided journals; does not submit or register official books. Supports validated date, source, search, sort and pagination filters.', parameters: [...pagination, ...['from', 'to', 'source', 'sortBy', 'sortDirection'].map((name) => ({ name, in: 'query', schema: { type: 'string' } }))], responses: { 200: { description: 'Paginated posted journal totals in centavos', content: json(paginated({ type: 'object' })) }, ...failures } } }
paths['/companies/{companyId}/sales-report-context'] = { parameters: [company], get: { tags: ['Accounting', 'Sales'], summary: 'Read persisted sales documents with customer names and report headers', description: 'Requires Accounting or Sales view. Includes default report templates and source documents; no password or customer contact details.', responses: { 200: { description: 'Company-scoped report inputs', content: json(envelope({ type: 'object' })) }, ...failures } } }
export const domainPaths = paths
