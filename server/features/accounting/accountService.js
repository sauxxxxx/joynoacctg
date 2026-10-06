import { ApiFailure } from '../../http/errors.js'
import { accountRepository, appendAudit } from './accountRepository.js'
import { accountSchema, categorySchema, listSchema, versionSchema } from './accountSchemas.js'
import { assertAccountUnreferenced } from '../records/references.js'

const validation = (field, message) => new ApiFailure('VALIDATION_ERROR', 422, message, { [field]: [message] })
const conflict = () => new ApiFailure('CONFLICT', 409, 'This record changed. Reload it and try again.')

function accountOperations(db, kind) {
  const repository = accountRepository(db, kind)
  const categories = accountRepository(db, 'categories')
  const accounts = accountRepository(db, 'accounts')

  async function requireRecord(companyId, id) {
    const record = await repository.get(companyId, id)
    if (!record) throw new ApiFailure('NOT_FOUND', 404, 'Record not found.')
    return record
  }

  async function validate(companyId, record, existing) {
    if (existing && existing.code !== record.code) throw validation('code', 'Codes cannot change after creation.')
    if (kind === 'accounts' && existing && existing.type !== record.type) await assertAccountUnreferenced(db, companyId, existing.id, existing.code)
    if (kind === 'accounts' && existing && existing.type !== record.type && (await db.query('SELECT id FROM journal_lines WHERE company_id = $1 AND account_id = $2 LIMIT 1', [companyId, existing.id])).rows.length) {
      throw validation('type', 'The type of an account used in journal entries cannot change.')
    }
    const duplicate = await repository.byCode(companyId, record.code)
    if (duplicate && duplicate.id !== existing?.id) throw validation('code', 'This code already exists.')
    if (record.parentCode) {
      const parent = await categories.byCode(companyId, record.parentCode)
      if (!parent?.active) throw validation('parentCode', 'Choose an active category in this company.')
      if (kind === 'accounts' && parent.accountType && parent.accountType !== record.type) throw validation('type', 'The account type must match its category.')
      if (kind === 'categories') {
        let ancestor = parent
        const seen = new Set([record.code])
        while (ancestor) {
          if (seen.has(ancestor.code)) throw validation('parentCode', 'A category cannot be its own ancestor.')
          seen.add(ancestor.code)
          ancestor = ancestor.parentCode ? await categories.byCode(companyId, ancestor.parentCode) : null
        }
      }
    }
  }

  async function save(context, record, existing) {
    await validate(context.companyId, record, existing)
    const saved = existing
      ? await repository.update(context.companyId, existing.id, record, existing.version)
      : await repository.create(context.companyId, record)
    if (!saved) throw conflict()
    await appendAudit(db, context, existing ? 'Updated' : 'Created', kind, saved.id, existing, saved)
    return saved
  }

  async function deleteRecord(context, id, version) {
    const record = await requireRecord(context.companyId, id)
    if (kind === 'accounts') await assertAccountUnreferenced(db, context.companyId, id, record.code)
    if (kind === 'accounts' && (await db.query('SELECT id FROM journal_lines WHERE company_id = $1 AND account_id = $2 LIMIT 1', [context.companyId, id])).rows.length) {
      throw new ApiFailure('CONFLICT', 409, 'This account is used in journal entries. Mark it inactive instead.')
    }
    if (kind === 'categories' && ((await categories.children(context.companyId, record.code)).length || (await accounts.children(context.companyId, record.code)).length)) {
      throw new ApiFailure('CONFLICT', 409, 'This category is referenced. Move its children or mark it inactive.')
    }
    if (!await repository.remove(context.companyId, id, version)) throw conflict()
    await appendAudit(db, context, 'Deleted', kind, id, record, null)
  }

  return { list: repository.list, get: requireRecord, save, deleteRecord }
}

export function accountService(db, kind) {
  const operations = accountOperations(db, kind)
  const schema = kind === 'accounts' ? accountSchema : categorySchema
  const mutate = (context, operation) => db.transaction(async (tx) => {
    await tx.lockCompany(context.companyId)
    return operation(accountOperations(tx, kind))
  })

  return {
    list(companyId, query) { return operations.list(companyId, listSchema(kind).parse(query)) },
    get: operations.get,
    create(context, body) {
      const record = schema.parse(body)
      return mutate(context, (service) => service.save(context, record))
    },
    update(context, id, body) {
      const { expectedVersion: version, ...record } = schema.extend({ expectedVersion: versionSchema }).parse(body)
      return mutate(context, async (service) => {
        const existing = await service.get(context.companyId, id)
        if (existing.version !== version) throw conflict()
        return service.save(context, record, existing)
      })
    },
    remove(context, id, expectedVersion) {
      const version = versionSchema.parse(expectedVersion)
      return mutate(context, (service) => service.deleteRecord(context, id, version))
    },
  }
}
