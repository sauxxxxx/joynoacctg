import { ApiFailure } from '../../http/errors.js'
import { typedRecordService } from '../records/typedRecordService.js'
import { taxSchemas } from './taxSchemas.js'

export function taxService(db, kind) {
  return typedRecordService(db, kind, taxSchemas, {
    validate(value, previous, records) {
      if (previous?.status !== 'Draft' && previous && value.status === 'Draft') throw new ApiFailure('INVALID_STATE_TRANSITION', 409, 'Completed records cannot become drafts. Keep corrections in their audit history.')
      if (kind !== 'tax-certificates' && records.some((record) => record.id !== previous?.id && record.formId === value.formId && record.year === value.year && record.period === value.period)) {
        throw new ApiFailure('VALIDATION_ERROR', 422, 'A record already exists for this form and period. Edit that record instead.')
      }
      if (previous && (value.formId !== previous.formId || kind !== 'tax-certificates' && (value.year !== previous.year || value.period !== previous.period))) {
        throw new ApiFailure('VALIDATION_ERROR', 422, 'The form and reporting period cannot change after creation.')
      }
    },
    beforeRemove(record) {
      if (record.status !== 'Draft') throw new ApiFailure('INVALID_STATE_TRANSITION', 409, 'Only drafts can be deleted. Keep completed records for the audit trail.')
    },
  })
}
