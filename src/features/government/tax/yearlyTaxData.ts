import { ref } from 'vue'

export const yearlyTaxFormIds = ['form-1604c', 'form-1604e', 'form-1604f', 'form-1702rt', 'form-0605'] as const
export type YearlyTaxFormId = typeof yearlyTaxFormIds[number]

export interface YearlyTaxConfig {
  title: string
  amountLabel: string
  entryLabel: string
}

export interface YearlyTaxRecord {
  id: string
  version?: number
  formId: YearlyTaxFormId
  year: number
  status: 'Draft' | 'Filed'
  amountCents: number
  deadline: string
  entry: string
}

export const yearlyTaxConfigs: Record<YearlyTaxFormId, YearlyTaxConfig> = {
  'form-1604c': { title: '1604-C', amountLabel: '', entryLabel: '' },
  'form-1604e': { title: '1604-E', amountLabel: '', entryLabel: '' },
  'form-1604f': { title: '1604-F', amountLabel: '', entryLabel: '' },
  'form-1702rt': { title: '1702RT', amountLabel: 'Tax due', entryLabel: 'Entry' },
  'form-0605': { title: '0605', amountLabel: 'Amount due', entryLabel: '' },
}

export const yearlyTaxRecords = ref<YearlyTaxRecord[]>([])

export function isYearlyTaxFormId(value: string): value is YearlyTaxFormId {
  return yearlyTaxFormIds.some((id) => id === value)
}

