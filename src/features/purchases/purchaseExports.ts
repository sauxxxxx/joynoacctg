import { downloadCsv } from '../../lib/csv'
import { purchaseVendorName, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'

export function exportPurchases(kind: PurchaseKind, records: PurchaseRecord[]) {
  downloadCsv(`${kind}.csv`, [
    ['Number', 'Date', 'Vendor', 'Status', 'Amount PHP', 'Recorded tax PHP', 'Total PHP', 'Paid PHP', 'Due date', 'Payroll month', 'Payroll year', 'Payroll period', 'Frequency', 'Pay group', 'Journal reference', 'Remarks'],
    ...records.map((record) => [record.number, record.date, purchaseVendorName(record.vendorId), record.status, record.amountCents / 100, record.taxCents / 100, record.totalCents / 100, record.paidCents / 100, record.dueDate || '', record.month, record.year, record.period, record.payrollFrequency, record.payGroup, record.journalEntryId || record.accrualJE, record.remarks]),
  ])
}
