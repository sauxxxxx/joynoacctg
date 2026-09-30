import { ref } from 'vue'

export const monthlyTaxFormIds = ['form-2550m', 'form-0619e', 'form-0619f', 'form-1601c', 'form-1600vt'] as const
export const quarterlyTaxFormIds = ['form-2550q', 'form-1702q', 'form-1601eq', 'form-1601fq'] as const
export const taxFormIds = [...monthlyTaxFormIds, ...quarterlyTaxFormIds] as const
export type TaxFormId = typeof taxFormIds[number]
export type TaxCadence = 'Monthly' | 'Quarterly'
export type TaxStatus = 'Draft' | 'Filed'

export interface TaxFormConfig {
  title: string
  rowCode: string
  cadence: TaxCadence
  hasTaxDue: boolean
  hasAmendment: boolean
  entryLabel: string
}

export interface TaxFormRecord {
  id: string
  formId: TaxFormId
  year: number
  status: TaxStatus
  period: string
  taxDueCents: number
  dueDate: string
  entry: string
  amendment: boolean
}

export const taxFormConfigs: Record<TaxFormId, TaxFormConfig> = {
  'form-2550m': { title: '2550-M', rowCode: '2550M', cadence: 'Monthly', hasTaxDue: true, hasAmendment: false, entryLabel: 'Entry' },
  'form-0619e': { title: '0619-E', rowCode: '0619E', cadence: 'Monthly', hasTaxDue: true, hasAmendment: false, entryLabel: '' },
  'form-0619f': { title: '0619-F', rowCode: '0619F', cadence: 'Monthly', hasTaxDue: true, hasAmendment: false, entryLabel: '' },
  'form-1601c': { title: '1601-C', rowCode: '1601C', cadence: 'Monthly', hasTaxDue: false, hasAmendment: true, entryLabel: '' },
  'form-1600vt': { title: '1600-VT', rowCode: '1600VT', cadence: 'Monthly', hasTaxDue: true, hasAmendment: false, entryLabel: '' },
  'form-2550q': { title: '2550-Q', rowCode: '2550Q', cadence: 'Quarterly', hasTaxDue: true, hasAmendment: false, entryLabel: 'Journal Entry' },
  'form-1702q': { title: '1702-Q', rowCode: '1702Q', cadence: 'Quarterly', hasTaxDue: true, hasAmendment: false, entryLabel: 'Entry' },
  'form-1601eq': { title: '1601-EQ', rowCode: '1601EQ', cadence: 'Quarterly', hasTaxDue: true, hasAmendment: false, entryLabel: '' },
  'form-1601fq': { title: '1601-FQ', rowCode: '1601FQ', cadence: 'Quarterly', hasTaxDue: true, hasAmendment: false, entryLabel: '' },
}

export const taxFormRecords = ref<TaxFormRecord[]>([
  {
    id: '0619e-2026-january', formId: 'form-0619e', year: 2026, status: 'Draft', period: 'January',
    taxDueCents: 0, dueDate: '2026-02-10', entry: '', amendment: false,
  },
])

export function isTaxFormId(value: string): value is TaxFormId {
  return taxFormIds.some((id) => id === value)
}
