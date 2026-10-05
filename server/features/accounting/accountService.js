import { transaction } from '../../db/transaction.js'
import { ApiFailure } from '../../http/errors.js'
import { accountRepository, appendAudit } from './accountRepository.js'
import { accountSchema, categorySchema, listSchema, versionSchema } from './accountSchemas.js'

const validation = (field, message) => new ApiFailure('VALIDATION_ERROR', 422, message, { [field]: [message] })
const conflict = () => new ApiFailure('CONFLICT', 409, 'This record changed. Reload it and try again.')

export function accountService(db, kind) {
  const repository = accountRepository(db, kind)
  const categories = accountRepository(db, 'categories')
  const accounts = accountRepository(db, 'accounts')
  const schema = kind === 'accounts' ? accountSchema : categorySchema

  function requireRecord(companyId, id) {
    const record = repository.get(companyId, id)
    if (!record) throw new ApiFailure('NOT_FOUND', 404, 'Record not found.')
    return record
  }

  function validate(companyId, record, existing) {
    if (existing && existing.code !== record.code) throw validation('code', 'Codes cannot change after creation.')
    const duplicate = repository.byCode(companyId, record.code)
    if (duplicate && duplicate.id !== existing?.id) throw validation('code', 'This code already exists.')
    if (record.parentCode) {
      const parent = categories.byCode(companyId, record.parentCode)
      if (!parent?.active) throw validation('parentCode', 'Choose an active category in this company.')
      if (kind === 'accounts' && parent.accountType && parent.accountType !== record.type) throw validation('type', 'The account type must match its category.')
      if (kind === 'categories') {
        let ancestor = parent
        const seen = new Set([record.code])
        while (ancestor) {
          if (seen.has(ancestor.code)) throw validation('parentCode', 'A category cannot be its own ancestor.')
          seen.add(ancestor.code)
          ancestor = ancestor.parentCode ? categories.byCode(companyId, ancestor.parentCode) : null
        }
      }
    }
  }

  return {
    list(companyId, query) { return repository.list(companyId, listSchema(kind).parse(query)) },
    get: requireRecord,
    create(context, body) {
      const record = schema.parse(body)
      return transaction(db, () => {
        validate(context.companyId, record)
        const saved = repository.create(context.companyId, record)
        appendAudit(db, context, 'Created', kind, saved.id, null, saved)
        return saved
      })
    },
    update(context, id, body) {
      const { expectedVersion: version, ...record } = schema.extend({ expectedVersion: versionSchema }).parse(body)
      return transaction(db, () => {
        const existing = requireRecord(context.companyId, id)
        if (existing.version !== version) throw conflict()
        validate(context.companyId, record, existing)
        const saved = repository.update(context.companyId, id, record, version)
        if (!saved) throw conflict()
        appendAudit(db, context, 'Updated', kind, id, existing, saved)
        return saved
      })
    },
    remove(context, id, expectedVersion) {
      const version = versionSchema.parse(expectedVersion)
      transaction(db, () => {
        const record = requireRecord(context.companyId, id)
        if (kind === 'categories' && (categories.children(context.companyId, record.code).length || accounts.children(context.companyId, record.code).length)) {
          throw new ApiFailure('CONFLICT', 409, 'This category is referenced. Move its children or mark it inactive.')
        }
        if (!repository.remove(context.companyId, id, version)) throw conflict()
        appendAudit(db, context, 'Deleted', kind, id, record, null)
      })
    },
  }
}
