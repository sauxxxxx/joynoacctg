import { downloadCsv } from '../../../lib/csv'
import type { TaxFormRecord } from './taxFormData'
import type { YearlyTaxRecord } from './yearlyTaxData'
import type { TaxCertificateRecord } from './taxCertificateData'
const amount = (cents: number) => (cents / 100).toFixed(2)
export function exportTaxForms(formId: string, records: TaxFormRecord[]) {
  downloadCsv(`${formId}-records.csv`, [['Form', 'Year', 'Period', 'Status', 'Tax due (PHP)', 'Due date', 'Entry reference', 'Amendment'],
    ...records.map((row) => [row.formId.replace('form-', ''), row.year, row.period, row.status, amount(row.taxDueCents), row.dueDate, row.entry, row.amendment ? 'Yes' : 'No'])])
}
export function exportYearlyTaxForms(formId: string, records: YearlyTaxRecord[]) {
  downloadCsv(`${formId}-records.csv`, [['Form', 'Year', 'Status', 'Amount (PHP)', 'Deadline', 'Entry reference'],
    ...records.map((row) => [row.formId.replace('form-', ''), row.year, row.status, amount(row.amountCents), row.deadline, row.entry])])
}
export function exportTaxCertificates(formId: string, records: TaxCertificateRecord[]) {
  downloadCsv(`${formId}-records.csv`, [['Form', 'Source', 'Party', 'TIN', 'Status', 'Amount (PHP)', 'Date', 'Period from', 'Period to', 'Signed file reference'],
    ...records.map((row) => [row.formId.replace('form-', ''), row.source, row.party, row.tin, row.status, amount(row.amountCents), row.date, row.fromDate, row.toDate, row.signedFile])])
}
