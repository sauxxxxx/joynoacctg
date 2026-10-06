import { ApiFailure } from '../../http/errors.js'
import { z } from 'zod'
import { appendAudit } from '../accounting/accountRepository.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { journalRepository } from '../accounting/journalRepository.js'
import { assertOpenPeriod, validateJournal } from '../accounting/journalService.js'
import { typedRecordService } from '../records/typedRecordService.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { requireAccount, requireRelatedRecord } from '../records/references.js'
import { bankQuerySchema, bankTransactionSchema, sourcesSchema } from './bankingSchemas.js'

const state = (message) => new ApiFailure('INVALID_STATE_TRANSITION', 409, message)
const exact = (value) => { if (!Number.isSafeInteger(value)) throw new ApiFailure('VALIDATION_ERROR', 422, 'The total exceeds the supported amount range.'); return value }
async function validateReferences(tx, context, value) {
  const bank = await requireRelatedRecord(tx, context.companyId, 'bank-accounts', value.bankAccountId)
  const cash = await requireAccount(tx, context.companyId, bank.ledgerAccountId, 'Asset')
  const counterpart = await requireAccount(tx, context.companyId, value.ledgerAccountId)
  if (cash.id === counterpart.id) throw new ApiFailure('VALIDATION_ERROR', 422, 'Choose a different account for the other side of this transaction.')
  await assertOpenPeriod(tx, context.companyId, value.date)
  return { cash, counterpart }
}
export function bankingService(db) {
  const records = typedRecordService(db, 'bank-transactions', { 'bank-transactions': bankTransactionSchema }, {
    querySchema: bankQuerySchema,
    matches: (record, query) => (!query.status || record.status === query.status) && (!query.bankAccountId || record.bankAccountId === query.bankAccountId) && (!query.from || record.date >= query.from) && (!query.to || record.date <= query.to),
    compare: (a, b, query) => (typeof a[query.sortBy] === 'number' ? a[query.sortBy] - b[query.sortBy] : String(a[query.sortBy]).localeCompare(String(b[query.sortBy]))) * (query.sortDirection === 'asc' ? 1 : -1),
    summarize: (items) => ({ amountCents: exact(items.filter((item) => item.status !== 'Voided').reduce((sum, item) => sum + item.amountCents, 0)) }),
    async validate(value, previous, _all, tx, context) {
      if (previous && previous.status !== 'Draft') throw state('Journalized and voided transactions are read-only.')
      if (value.status !== 'Draft' || value.journalEntryId) throw state('Create or void journals through the transaction actions, not by editing its status.')
      const { counterpart } = await validateReferences(tx, context, value)
      value.ledgerAccountId = counterpart.id
    },
    async beforeRemove(record, tx, context) {
      if (record.status !== 'Draft') throw state('Only draft bank transactions can be deleted.')
      await assertOpenPeriod(tx, context.companyId, record.date)
    },
  })
  return {
    ...records,
    async createJournals(context, body) {
      const { sourceIds } = sourcesSchema.parse(body)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const repository = jsonRecordRepository(tx, 'bank-transactions')
        const journals = journalRepository(tx)
        const result = { created: 0, existing: 0, journalEntryIds: [] }
        for (const id of sourceIds) {
          const record = await repository.get(context.companyId, id)
          if (!record) throw new ApiFailure('NOT_FOUND', 404, 'One of the selected transactions is unavailable.')
          const sourceKey = `bank-transaction:${id}`
          const existing = await journals.source(context.companyId, sourceKey)
          if (existing && record.status === 'Journalized' && record.journalEntryId === existing.id) { result.existing++; result.journalEntryIds.push(existing.id); continue }
          if (record.status !== 'Draft' || existing) throw state('This transaction cannot be journalized again.')
          const { cash, counterpart } = await validateReferences(tx, context, record)
          const receipt = record.direction === 'Receipt'
          const value = { kind: receipt ? 'cash-receipt-journal' : 'cash-disbursement-journal', date: record.date, referenceNumber: record.reference,
            party: record.party, remarks: record.description || record.purpose, sourceKey, status: 'Posted', lines: [
              { accountId: receipt ? cash.id : counterpart.id, debitCents: record.amountCents, creditCents: 0 },
              { accountId: receipt ? counterpart.id : cash.id, debitCents: 0, creditCents: record.amountCents },
            ] }
          await validateJournal(tx, context.companyId, value)
          const entryId = await journals.create(context, value)
          const entry = await journals.get(context.companyId, entryId)
          const { id: _id, version: _version, ...input } = record
          const saved = await repository.save(context.companyId, id, { ...input, status: 'Journalized', journalEntryId: entryId })
          await appendAudit(tx, context, 'Posted', 'journal-entries', entryId, null, entry)
          await appendAudit(tx, context, 'Journalized', 'bank-transactions', id, record, saved)
          result.created++; result.journalEntryIds.push(entryId)
        }
        return result
      })
    },
    async voidTransaction(context, id, body) {
      const { expectedVersion: version } = z.object({ expectedVersion: versionSchema }).strict().parse(body)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const repository = jsonRecordRepository(tx, 'bank-transactions')
        const previous = await repository.get(context.companyId, id)
        if (!previous) throw new ApiFailure('NOT_FOUND', 404, 'Bank transaction not found.')
        if (previous.version !== version) throw new ApiFailure('CONFLICT', 409, 'This transaction changed. Reload before continuing.')
        if (previous.status !== 'Journalized') throw state('Only journalized transactions can be voided.')
        await assertOpenPeriod(tx, context.companyId, previous.date)
        const journals = journalRepository(tx)
        const before = await journals.get(context.companyId, previous.journalEntryId)
        if (!before || before.status !== 'Posted') throw state('The related journal is not posted. Review its history before continuing.')
        await tx.query("UPDATE journal_entries SET status = 'Voided', voided_at = $3, version = version + 1 WHERE company_id = $1 AND id = $2", [context.companyId, before.id, new Date().toISOString()])
        const { id: _id, version: _version, ...input } = previous
        const saved = await repository.save(context.companyId, id, { ...input, status: 'Voided' })
        await appendAudit(tx, context, 'Voided', 'journal-entries', before.id, before, await journals.get(context.companyId, before.id))
        await appendAudit(tx, context, 'Voided', 'bank-transactions', id, previous, saved)
        return saved
      })
    },
  }
}
