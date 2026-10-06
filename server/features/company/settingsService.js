import { ApiFailure } from '../../http/errors.js'
import { z } from 'zod'
import { appendAudit } from '../accounting/accountRepository.js'
import { defaultSettings, settingsSchemas } from './settingsSchemas.js'
import { inspectFile } from '../documents/fileValidation.js'

export function settingsService(db) {
  function schema(kind) {
    if (!Object.hasOwn(settingsSchemas, kind)) throw new ApiFailure('NOT_FOUND', 404, 'Settings not found.')
    return settingsSchemas[kind]
  }
  async function read(connection, companyId, kind) {
    schema(kind)
    const record = (await connection.query('SELECT payload, version FROM company_settings WHERE company_id = $1 AND kind = $2', [companyId, kind])).rows[0]
    if (record) return { ...JSON.parse(record.payload), version: record.version }
    const company = (await connection.query('SELECT name FROM companies WHERE id = $1', [companyId])).rows[0]
    return { ...defaultSettings(kind, company.name), version: 0 }
  }
  return {
    load: (companyId, kind) => read(db, companyId, kind),
    async save(context, kind, body) {
      const { expectedVersion, ...input } = body
      const version = z.number().int().safe().nonnegative().parse(expectedVersion)
      const value = schema(kind).parse(input)
      if (kind === 'profile' && value.logo) {
        const [prefix, content] = value.logo.split(',')
        const type = prefix.slice(5, prefix.indexOf(';'))
        const bytes = Buffer.from(content, 'base64')
        if (inspectFile(bytes, { fileName: `logo.${type.split('/')[1] === 'jpeg' ? 'jpg' : type.split('/')[1]}`, size: bytes.length }).mimeType !== type) throw new ApiFailure('VALIDATION_ERROR', 422, 'The logo does not match its declared image type.')
      }
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const previous = await read(tx, context.companyId, kind)
        if (previous.version !== version) throw new ApiFailure('CONFLICT', 409, 'These settings changed. Reload before saving again.')
        if (kind === 'mappings') {
          const seen = new Set()
          for (const row of value.rows) {
            if (seen.has(row.label)) throw new ApiFailure('VALIDATION_ERROR', 422, 'Each account mapping must have a unique name.')
            seen.add(row.label)
            if (!row.accountId) continue
            const account = (await tx.query('SELECT id FROM accounts WHERE company_id = $1 AND (id = $2 OR code = $2) AND active = 1', [context.companyId, row.accountId])).rows[0]
            if (!account) throw new ApiFailure('VALIDATION_ERROR', 422, 'Choose an active account in this company.')
          }
        }
        if (!version) await tx.query('INSERT INTO company_settings (company_id, kind, payload, version) VALUES ($1, $2, $3, 1)', [context.companyId, kind, JSON.stringify(value)])
        else await tx.query('UPDATE company_settings SET payload = $3, version = version + 1 WHERE company_id = $1 AND kind = $2', [context.companyId, kind, JSON.stringify(value)])
        if (kind === 'profile') await tx.query('UPDATE companies SET name = $2 WHERE id = $1', [context.companyId, value.companyName])
        const saved = { ...value, version: version + 1 }
        await appendAudit(tx, context, 'Updated', 'settings', kind, previous, saved)
        return saved
      })
    },
  }
}
