import { getAgingBucket } from '../../../lib/aging'
import type { PurchaseRecord } from '../purchasePreviewData'
export type PurchaseReportKind = 'payable-schedule' | 'payable-aging' | 'revolving-fund-logs'

export interface PayableReportRow {
  id: string
  vendor: string
  dueDate: string
  balanceCents: number
  currentCents: number
  oneToThirtyCents: number
  thirtyOneToSixtyCents: number
  sixtyOneToNinetyCents: number
  overNinetyCents: number
}

/** Only posted invoices and payments dated on or before the report date contribute. */
export function buildPayableRows(records: PurchaseRecord[], asOf: string, vendorName: (id: string) => string): PayableReportRow[] {
  const bucketKey = { current: 'currentCents', '1-30': 'oneToThirtyCents', '31-60': 'thirtyOneToSixtyCents', '61-90': 'sixtyOneToNinetyCents', '90+': 'overNinetyCents' } as const
  return records.filter((record) => record.kind === 'purchase-invoices' && record.status === 'Posted' && record.date <= asOf).flatMap((invoice) => {
    const paid = records.filter((record) => record.status === 'Posted' && record.date <= asOf).flatMap((record) => record.allocations || []).filter((row) => row.invoiceId === invoice.id).reduce((total, row) => total + row.amountCents, 0)
    const balanceCents = Math.max(0, invoice.totalCents - paid)
    if (!balanceCents) return []
    const dueDate = invoice.dueDate || invoice.date
    const row: PayableReportRow = { id: invoice.id, vendor: vendorName(invoice.vendorId), dueDate, balanceCents, currentCents: 0, oneToThirtyCents: 0, thirtyOneToSixtyCents: 0, sixtyOneToNinetyCents: 0, overNinetyCents: 0 }
    row[bucketKey[getAgingBucket(dueDate, new Date(`${asOf}T00:00:00`))]] = balanceCents
    return [row]
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id))
}
