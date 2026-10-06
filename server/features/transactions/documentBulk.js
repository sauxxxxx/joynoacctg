import { createHash } from 'node:crypto'
import { z } from 'zod'
import { ApiFailure } from '../../http/errors.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { salesSchema } from './documentSchemas.js'
import { validateDocument } from './documentValidation.js'

export const bulkSchema = z.object({ batchKey: z.uuid(), documents: z.array(salesSchema).min(1).max(100) }).strict()
export async function saveDocumentBulk(db, context, body) {
  const input = bulkSchema.parse(body)
  if (input.documents.some((record) => record.kind !== 'sales-invoices' || record.status !== 'Draft')) throw new ApiFailure('VALIDATION_ERROR', 422, 'Bulk entry accepts only draft sales invoices.')
  const hash = createHash('sha256').update(JSON.stringify(input.documents)).digest('hex')
  return db.transaction(async (tx) => {
    await tx.lockCompany(context.companyId)
    const batches = jsonRecordRepository(tx, 'sales-document-batches')
    const batch = (await batches.all(context.companyId)).find((record) => record.batchKey === input.batchKey)
    const repository = jsonRecordRepository(tx, 'sales-documents')
    if (batch) {
      if (batch.hash !== hash) throw new ApiFailure('CONFLICT', 409, 'This batch key was already used for different invoices.')
      const records = await Promise.all(batch.ids.map((id) => repository.get(context.companyId, id)))
      if (records.some((record) => !record)) throw new ApiFailure('CONFLICT', 409, 'This batch was already saved; some of its drafts have since been removed. Reload the invoice list.')
      return records
    }
    const existing = await repository.all(context.companyId)
    const saved = []
    for (const record of input.documents) {
      await validateDocument(record, null, existing, tx, context, 'sales-documents')
      const value = await repository.save(context.companyId, null, record)
      await appendAudit(tx, context, 'Created', 'sales-documents', value.id, null, value)
      existing.push(value); saved.push(value)
    }
    await batches.save(context.companyId, null, { batchKey: input.batchKey, hash, ids: saved.map((record) => record.id) })
    return saved
  })
}
