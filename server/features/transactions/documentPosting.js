import { z } from 'zod'
import { ApiFailure } from '../../http/errors.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { journalSchema } from '../accounting/journalSchemas.js'
import { journalRepository } from '../accounting/journalRepository.js'
import { assertOpenPeriod, validateJournal } from '../accounting/journalService.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { requireRelatedRecord } from '../records/references.js'
import { invalid, stateError, sum, validateAllocations } from './documentMath.js'

export const postingSchema = z.object({ expectedVersion: versionSchema, lines: journalSchema.shape.lines }).strict()
export const voidSchema = z.object({ expectedVersion: versionSchema, reason: z.string().trim().min(3).max(500) }).strict()
const notFound = () => new ApiFailure('NOT_FOUND', 404, 'Document not found.')
const amountOf = (record, domain) => domain === 'sales-documents' ? record.amountCents : record.totalCents
const conflict = () => new ApiFailure('CONFLICT', 409, 'This document changed. Reload before continuing.')
const withoutIdentity = ({ id: _id, version: _version, ...value }) => value

export function documentPosting(db, domain) {
  async function get(tx, companyId, id) {
    const record = await jsonRecordRepository(tx, domain).get(companyId, id)
    if (!record) throw notFound()
    return record
  }
  return {
    async post(context, id, body) {
      const input = postingSchema.parse(body)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const repository = jsonRecordRepository(tx, domain)
        const previous = await get(tx, context.companyId, id)
        const journals = journalRepository(tx)
        const sourceKey = `${domain}:${id}`
        const existing = await journals.source(context.companyId, sourceKey)
        // Retry only the identical review, never a different stale posting request.
        if (previous.journalEntryId && existing?.status === 'Posted' && existing.id === previous.journalEntryId && previous.version === input.expectedVersion + 1) {
          const normalize = (lines) => lines.map((line) => ({ accountId: line.accountId, debitCents: line.debitCents, creditCents: line.creditCents, subsidiary: line.subsidiary || '', remarks: line.remarks || '' }))
          if (JSON.stringify(normalize(existing.lines)) === JSON.stringify(normalize(input.lines))) return previous
        }
        if (previous.version !== input.expectedVersion) throw conflict()
        if (previous.journalEntryId || existing || ['Posted', 'Cancelled', 'Voided'].includes(previous.status)) throw stateError('This document cannot be posted again.')
        if (previous.kind === 'acknowledgement-receipts') throw stateError('Acknowledgements track receipt of documents or funds; post an invoice or collection receipt for accounting.')
        const records = await repository.all(context.companyId)
        validateAllocations(previous, records, domain, true)
        const invoice = ['sales-invoices', 'purchase-invoices', 'payrolls'].includes(previous.kind)
        const sales = domain === 'sales-documents'
        const party = previous.kind === 'payrolls' ? { name: `Payroll ${previous.year}-${previous.month.padStart(2, '0')}` }
          : await requireRelatedRecord(tx, context.companyId, sales ? 'customers' : 'purchase-setup', sales ? previous.customerId : previous.vendorId, sales ? undefined : 'vendors', false)
        const entry = { kind: invoice ? sales ? 'sales-journal' : 'purchase-journal' : sales ? 'cash-receipt-journal' : 'cash-disbursement-journal',
          date: previous.date, referenceNumber: previous.number, party: party.name, remarks: previous.remarks, sourceKey, status: 'Posted', lines: input.lines }
        await validateJournal(tx, context.companyId, entry)
        if (sum(entry.lines.map((line) => line.debitCents)) !== amountOf(previous, domain)) throw invalid('The reviewed journal total must equal the document total. Review recorded tax and discount amounts before posting.')
        const entryId = await journals.create(context, entry)
        const saved = await repository.save(context.companyId, id, { ...withoutIdentity(previous), journalEntryId: entryId, status: sales && invoice ? 'Unpaid' : 'Posted' })
        await appendAudit(tx, context, 'Posted', 'journal-entries', entryId, null, await journals.get(context.companyId, entryId))
        await appendAudit(tx, context, 'Posted', domain, id, previous, saved)
        return saved
      })
    },
    async void(context, id, body) {
      const input = voidSchema.parse(body)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const repository = jsonRecordRepository(tx, domain)
        const previous = await get(tx, context.companyId, id)
        if (previous.version !== input.expectedVersion) throw conflict()
        if (['Cancelled', 'Voided'].includes(previous.status)) throw stateError('This document is already voided.')
        await assertOpenPeriod(tx, context.companyId, previous.date)
        const records = await repository.all(context.companyId)
        const dependent = records.some((record) => record.id !== id && !['Cancelled', 'Voided'].includes(record.status) && (domain === 'sales-documents' ? record.payments : record.allocations || []).some((row) => row.invoiceId === id))
        if (dependent) throw stateError('Void or remove the related receipt and payment allocations before voiding this invoice.')
        if (!previous.journalEntryId && previous.kind !== 'acknowledgement-receipts' && previous.status === 'Draft') throw stateError('Delete unissued drafts instead of voiding them.')
        if (previous.journalEntryId) {
          const journals = journalRepository(tx)
          const entry = await journals.get(context.companyId, previous.journalEntryId)
          if (!entry || entry.status !== 'Posted' || entry.sourceKey !== `${domain}:${id}`) throw stateError('The linked journal is unavailable or is not posted. Review the record history.')
          await tx.query("UPDATE journal_entries SET status = 'Voided', voided_at = $3, version = version + 1 WHERE company_id = $1 AND id = $2", [context.companyId, entry.id, new Date().toISOString()])
          await appendAudit(tx, context, 'Voided', 'journal-entries', entry.id, entry, await journals.get(context.companyId, entry.id))
        }
        const saved = await repository.save(context.companyId, id, { ...withoutIdentity(previous), status: domain === 'sales-documents' ? 'Cancelled' : 'Voided' })
        await appendAudit(tx, context, 'Voided', domain, id, previous, { ...saved, voidReason: input.reason })
        return saved
      })
    },
  }
}
