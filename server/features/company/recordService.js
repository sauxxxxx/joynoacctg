import { ApiFailure } from '../../http/errors.js'
import { typedRecordService } from '../records/typedRecordService.js'
import { recordSchemas } from './recordSchemas.js'
import { assertUnreferenced } from '../records/references.js'

export function companyRecordService(db, kind) {
  return typedRecordService(db, kind, recordSchemas, {
    entityType: `company/${kind}`,
    beforeRemove: (record, tx, context) => assertUnreferenced(tx, context.companyId, [record.id]),
    validate(value, previous, records) {
      if (kind === 'report template' && value.isDefault && records.some((record) => record.id !== previous?.id && record.isDefault && record.report === value.report)) throw new ApiFailure('VALIDATION_ERROR', 422, 'This report already has a default template.')
      if (kind === 'series' && value.resetFrequency !== 'Never') {
        const pattern = value.prefix + value.suffix
        if (!/\{YYYY\}|\{YY\}/.test(pattern) || value.resetFrequency === 'Monthly' && !pattern.includes('{MM}')) throw new ApiFailure('VALIDATION_ERROR', 422, 'Restarting series need a year token; monthly series also need {MM}.')
      }
      if (['good', 'service', 'item'].includes(kind) && value.kind !== { good: 'goods', service: 'services', item: 'others' }[kind]) {
        throw new ApiFailure('VALIDATION_ERROR', 422, 'Choose the correct item category.')
      }
      const key = value.code ? 'code' : value.name ? 'name' : kind === 'series' && value.active ? 'documentType' : null
      if (key && records.some((record) => record.id !== previous?.id && (!('active' in value) || record.active) && String(record[key]).toLowerCase() === String(value[key]).toLowerCase())) {
        throw new ApiFailure('VALIDATION_ERROR', 422, 'Another record already uses this code or name.')
      }
    },
  })
}
