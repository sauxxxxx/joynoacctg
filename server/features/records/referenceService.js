import { z } from 'zod'
import { accountRepository } from '../accounting/accountRepository.js'
import { listSchema } from '../accounting/accountSchemas.js'
import { jsonRecordRepository } from './jsonRecordRepository.js'

const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(100) }).strict()
export function referenceService(db) {
  return {
    async accounts(companyId, query) {
      const result = await accountRepository(db, 'accounts').list(companyId, listSchema('accounts').parse(query))
      return { ...result, data: result.data.map(({ id, code, name, type, parentCode, active, version }) => ({ id, code, name, type, parentCode, active, version, remarks: '', itr: '', legalBasis: '' })) }
    },
    async records(companyId, kind, query) {
      const { page, pageSize } = pageQuery.parse(query)
      if (kind === 'series' || kind === 'catalog') {
        const kinds = kind === 'series' ? ['series'] : ['good', 'service', 'item']
        const all = (await Promise.all(kinds.map((key) => jsonRecordRepository(db, key).all(companyId)))).flat()
        const data = kind === 'series' ? all.map(({ id, documentType, prefix, suffix, nextNumber, padding, resetFrequency, active }) => ({ id, documentType, prefix, suffix, nextNumber, padding, resetFrequency, active }))
          : all.map(({ id, kind, code, name, description, unit, sellingPriceCents, category, active }) => ({ id, kind, code, name, description, unit, sellingPriceCents, category, active, costCents: 0 }))
        return { data: data.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: data.length, totalPages: Math.max(1, Math.ceil(data.length / pageSize)) }
      }
      const data = (await jsonRecordRepository(db, kind === 'vendors' ? 'purchase-setup' : 'good').all(companyId))
        .filter((record) => kind !== 'vendors' || record.kind === 'vendors')
        .map(({ id, name, code, active }) => ({ id, name, code: code || '', active }))
        .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
      return { data: data.slice((page - 1) * pageSize, page * pageSize), page, pageSize, total: data.length, totalPages: Math.max(1, Math.ceil(data.length / pageSize)) }
    },
  }
}
