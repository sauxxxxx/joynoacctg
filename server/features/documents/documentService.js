import { createHash } from 'node:crypto'
import { ApiFailure } from '../../http/errors.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { documentListSchema, COMPANY_QUOTA_BYTES } from './documentSchemas.js'
import { inspectFile, readMetadata } from './fileValidation.js'

const conflict = () => new ApiFailure('CONFLICT', 409, 'This document changed. Reload before continuing.')
export function privateDocumentService(db) {
  const repository = (tx) => jsonRecordRepository(tx, 'documents')
  async function get(tx, companyId, id) {
    const record = await repository(tx).get(companyId, id)
    if (!record) throw new ApiFailure('NOT_FOUND', 404, 'Document not found.')
    return record
  }
  return {
    async list(companyId, query) {
      const { page, pageSize, search, archived } = documentListSchema.parse(query)
      const all = (await repository(db).all(companyId)).filter((record) => Boolean(record.archived) === (archived === 'true') && `${record.name} ${record.fileName} ${record.reference} ${record.notes}`.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id))
      return { data: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize, totalPages: Math.max(1, Math.ceil(all.length / pageSize)) }
    },
    async upload(context, header, bytes) {
      const metadata = readMetadata(header)
      const inspected = inspectFile(bytes, metadata)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const used = Number((await tx.query('SELECT COALESCE(SUM(size_bytes), 0) AS size FROM document_contents WHERE company_id = $1', [context.companyId])).rows[0].size)
        if (used + bytes.length > COMPANY_QUOTA_BYTES) throw new ApiFailure('VALIDATION_ERROR', 422, 'The 500 MB document storage allowance is full. Contact your administrator; archived files remain retained.')
        const saved = await repository(tx).save(context.companyId, null, { ...metadata, mimeType: inspected.mimeType, sha256: inspected.sha256, uploadedAt: new Date().toISOString(), archived: false })
        await tx.query('INSERT INTO document_contents (company_id, document_id, content_base64, size_bytes, sha256) VALUES ($1,$2,$3,$4,$5)', [context.companyId, saved.id, bytes.toString('base64'), bytes.length, inspected.sha256])
        await appendAudit(tx, context, 'Uploaded', 'documents', saved.id, null, saved)
        return saved
      })
    },
    async content(companyId, id) {
      const metadata = await get(db, companyId, id)
      const row = (await db.query('SELECT * FROM document_contents WHERE company_id = $1 AND document_id = $2', [companyId, id])).rows[0]
      if (!row) throw new ApiFailure('NOT_FOUND', 404, 'File content not found.')
      const bytes = Buffer.from(row.content_base64, 'base64')
      if (bytes.length !== row.size_bytes || createHash('sha256').update(bytes).digest('hex') !== row.sha256 || metadata.sha256 !== row.sha256) throw new ApiFailure('INTERNAL_ERROR', 500, 'The file failed its integrity check. Contact your administrator.')
      return { metadata, bytes }
    },
    async archive(context, id, version, archived = true) {
      version = versionSchema.parse(version)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const previous = await get(tx, context.companyId, id)
        if (previous.version !== version) throw conflict()
        if (Boolean(previous.archived) === archived) throw new ApiFailure('INVALID_STATE_TRANSITION', 409, archived ? 'This document is already archived.' : 'This document is already active.')
        const { id: _id, version: _version, ...record } = previous
        const saved = await repository(tx).save(context.companyId, id, { ...record, archived })
        await appendAudit(tx, context, archived ? 'Archived' : 'Restored', 'documents', id, previous, saved)
        return saved
      })
    },
  }
}
