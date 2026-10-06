import { ApiFailure } from '../../http/errors.js'
import { typedRecordService } from './typedRecordService.js'
import { masterQuerySchema, masterSchemas } from './masterSchemas.js'
import { assertUnreferenced, requireAccount, requireRelatedRecord } from './references.js'
import { jsonRecordRepository } from './jsonRecordRepository.js'
import { appendAudit } from '../accounting/accountRepository.js'

export function masterService(db, kind) {
  return typedRecordService(db, kind, masterSchemas, {
    querySchema: masterQuerySchema,
    matches: (record, query) => (!query.kind || record.kind === query.kind) && (query.active === undefined || record.active === (query.active === 'true')),
    compare: (a, b, query) => String(a[query.sortBy] || '').localeCompare(String(b[query.sortBy] || '')) * (query.sortDirection === 'desc' ? -1 : 1),
    async validate(value, previous, records, tx, context) {
      if (previous && value.kind !== previous.kind) throw new ApiFailure('VALIDATION_ERROR', 422, 'The record category cannot change after creation.')
      const others = records.filter((record) => record.id !== previous?.id && record.kind === value.kind)
      if (kind !== 'bank-accounts' && value.name && others.some((record) => record.name.toLowerCase() === value.name.toLowerCase())) throw new ApiFailure('VALIDATION_ERROR', 422, 'Another record already uses this name.')
      if (kind === 'customers' && value.isDefault) {
        for (const record of others.filter((item) => item.isDefault)) {
          const { id, version: _version, ...input } = record
          const saved = await jsonRecordRepository(tx, kind).save(context.companyId, id, { ...input, isDefault: false })
          await appendAudit(tx, context, 'Updated', kind, id, record, saved)
        }
      }
      if (value.accountId) await requireAccount(tx, context.companyId, value.accountId)
      if (kind === 'bank-accounts') {
        const account = await requireAccount(tx, context.companyId, value.ledgerAccountId, 'Asset')
        value.ledgerAccountId = account.id
        if (value.accountNumber && others.some((record) => record.accountNumber === value.accountNumber)) throw new ApiFailure('VALIDATION_ERROR', 422, 'This bank account number is already recorded.')
        if (previous && value.ledgerAccountId !== previous.ledgerAccountId && (await jsonRecordRepository(tx, 'bank-transactions').all(context.companyId)).some((record) => record.bankAccountId === previous.id)) {
          throw new ApiFailure('CONFLICT', 409, 'A bank account used in transactions must keep its ledger account.')
        }
      }
      if (kind === 'fixed-assets') {
        await requireRelatedRecord(tx, context.companyId, 'purchase-setup', value.vendorId, 'vendors', !previous || previous.vendorId !== value.vendorId)
        if (value.itemId) await requireRelatedRecord(tx, context.companyId, 'good', value.itemId, 'goods', !previous || previous.itemId !== value.itemId)
        if (value.trackingNumber && others.some((record) => record.trackingNumber === value.trackingNumber)) throw new ApiFailure('VALIDATION_ERROR', 422, 'This asset tracking number is already recorded.')
      }
    },
    beforeRemove: (record, tx, context) => assertUnreferenced(tx, context.companyId, [record.id]),
  })
}
