import { typedRecordService } from '../records/typedRecordService.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { assertOpenPeriod } from '../accounting/journalService.js'
import { allocated, stateError } from './documentMath.js'
import { documentSchemas } from './documentSchemas.js'
import { validateDocument } from './documentValidation.js'

export function documentService(db, domain) {
  const service = typedRecordService(db, domain, documentSchemas, {
    validate: (...args) => validateDocument(...args, domain),
    async beforeRemove(record, tx, context) {
      if (record.journalEntryId || record.status !== 'Draft') throw stateError('Only unposted drafts can be deleted. Void issued records instead.')
      await assertOpenPeriod(tx, context.companyId, record.date)
    },
  })
  const decorate = (record, records) => {
    if (domain === 'purchases' && record.kind === 'purchase-invoices') return { ...record, paidCents: allocated(records, record.id, domain) }
    return record
  }
  return { ...service,
    async list(companyId, query) {
      const result = await service.list(companyId, query)
      const records = await jsonRecordRepository(db, domain).all(companyId)
      return { ...result, data: result.data.map((record) => decorate(record, records)) }
    },
    async get(companyId, id) { return decorate(await service.get(companyId, id), await jsonRecordRepository(db, domain).all(companyId)) },
  }
}
