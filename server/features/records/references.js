import { ApiFailure } from '../../http/errors.js'
import { jsonRecordRepository } from './jsonRecordRepository.js'

export async function requireAccount(db, companyId, id, type) {
  const row = (await db.query('SELECT * FROM accounts WHERE company_id = $1 AND (id = $2 OR code = $2) AND active = 1', [companyId, id])).rows[0]
  if (!row || type && row.type !== type) throw new ApiFailure('VALIDATION_ERROR', 422, `Choose an active ${type ? type.toLowerCase() + ' ' : ''}account in this company.`)
  return row
}
export async function requireRelatedRecord(db, companyId, kind, id, subtype, active = true) {
  const row = await jsonRecordRepository(db, kind).get(companyId, id)
  if (!row || subtype && row.kind !== subtype || active && row.active === false) throw new ApiFailure('VALIDATION_ERROR', 422, 'Choose a valid active record from this company.')
  return row
}
const referenceFields = new Set(['customerId', 'vendorId', 'custodianId', 'seriesId', 'itemId', 'bankAccountId', 'ledgerAccountId', 'accountId', 'paymentTermId', 'paymentMethodId', 'discountTypeId', 'invoiceId', 'journalEntryId'])
function containsReference(value, targets) {
  if (!value || typeof value !== 'object') return false
  return Object.entries(value).some(([key, field]) => referenceFields.has(key) && targets.includes(field) || typeof field === 'object' && containsReference(field, targets))
}
export async function assertUnreferenced(db, companyId, targets) {
  const records = (await db.query('SELECT id, payload FROM company_records WHERE company_id = $1', [companyId])).rows
  if (records.some((row) => !targets.includes(row.id) && containsReference(JSON.parse(row.payload), targets))) {
    throw new ApiFailure('CONFLICT', 409, 'This record is used by other records. Keep it for the history or mark it inactive.')
  }
}
export async function assertAccountUnreferenced(db, companyId, id, code) {
  await assertUnreferenced(db, companyId, [id, code])
  const settings = (await db.query("SELECT payload FROM company_settings WHERE company_id = $1 AND kind = 'mappings'", [companyId])).rows
  if (settings.some((row) => containsReference(JSON.parse(row.payload), [id, code]))) throw new ApiFailure('CONFLICT', 409, 'This account is used in company mappings. Clear the mapping before deleting it.')
}
