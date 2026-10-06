import { z } from 'zod'
import { ApiFailure } from '../../http/errors.js'
import { appendAudit } from '../accounting/accountRepository.js'
import { versionSchema } from '../accounting/accountSchemas.js'
import { jsonRecordRepository } from './jsonRecordRepository.js'
const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().max(200).default('') }).strict()

/** A register must supply an explicit schema and business rules, never arbitrary JSON. */
export function typedRecordService(db, kind, schemas, rules = {}) {
  if (!Object.hasOwn(schemas, kind)) throw new ApiFailure('NOT_FOUND', 404, 'Record type not found.')
  async function get(connection, companyId, id) {
    const value = await jsonRecordRepository(connection, kind).get(companyId, id)
    if (!value) throw new ApiFailure('NOT_FOUND', 404, 'Record not found.')
    return value
  }
  const conflict = () => new ApiFailure('CONFLICT', 409, 'This record changed. Reload before continuing.')
  return {
    get: (companyId, id) => get(db, companyId, id),
    async list(companyId, query) {
      const parsed = (rules.querySchema || querySchema).parse(query)
      const { page, pageSize, search } = parsed
      let items = (await jsonRecordRepository(db, kind).all(companyId)).filter((item) => Object.values(item).join(' ').toLowerCase().includes(search.toLowerCase()) && (!rules.matches || rules.matches(item, parsed)))
      if (rules.compare) items = items.sort((a, b) => rules.compare(a, b, parsed) || a.id.localeCompare(b.id))
      return { data: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, totalPages: Math.max(1, Math.ceil(items.length / pageSize)), ...(rules.summarize ? { summary: rules.summarize(items) } : {}) }
    },
    async save(context, id, body) {
      const { expectedVersion, ...input } = body
      const value = schemas[kind].parse(input)
      if (id) versionSchema.parse(expectedVersion)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const repository = jsonRecordRepository(tx, kind)
        const previous = id ? await get(tx, context.companyId, id) : null
        if (previous && previous.version !== versionSchema.parse(expectedVersion)) throw conflict()
        await rules.validate?.(value, previous, await repository.all(context.companyId), tx, context)
        const saved = await repository.save(context.companyId, id, value)
        await appendAudit(tx, context, previous ? 'Updated' : 'Created', rules.entityType || kind, saved.id, previous, saved)
        return saved
      })
    },
    async remove(context, id, version) {
      versionSchema.parse(version)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const previous = await get(tx, context.companyId, id)
        if (previous.version !== versionSchema.parse(version)) throw conflict()
        await rules.beforeRemove?.(previous, tx, context)
        await jsonRecordRepository(tx, kind).remove(context.companyId, id)
        await appendAudit(tx, context, 'Deleted', rules.entityType || kind, id, previous, null)
      })
    },
  }
}
