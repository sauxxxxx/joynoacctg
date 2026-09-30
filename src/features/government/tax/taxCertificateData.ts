import { ref } from 'vue'

export const taxCertificateIds = ['form-2306', 'form-2307'] as const
export type TaxCertificateId = typeof taxCertificateIds[number]
export type CertificateStatus = 'Draft' | 'Received' | 'Sent'

export interface TaxCertificateRecord {
  id: string
  formId: TaxCertificateId
  source: string
  party: string
  status: CertificateStatus
  amountCents: number
  date: string
  fromDate: string
  toDate: string
  signedFile: string
  tin: string
}

export const taxCertificateRecords = ref<TaxCertificateRecord[]>([])

export function isTaxCertificateId(value: string): value is TaxCertificateId {
  return taxCertificateIds.some((id) => id === value)
}

