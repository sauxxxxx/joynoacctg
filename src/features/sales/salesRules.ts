import type { SalesDocument, SalesLineItem, SetupRecord } from './salesPreviewStore'

/**
 * Invoice rules shared by the invoice editor and the invoice list.
 *
 * Assumptions pending confirmation:
 * - A payment term's "Due On" counts days or months (its "Payment Due" unit) from the invoice date.
 *   Month steps land on the same day, or the month's last day when that day does not exist.
 * - An issued invoice shows as Paid once posted receipts linked to it cover its total.
 */

export function computeDueDate(invoiceDate: string, term: Pick<SetupRecord, 'dueOn' | 'paymentDue'> | undefined): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)) return ''
  const [year, month, day] = invoiceDate.split('-').map(Number)
  const steps = Math.max(0, Math.trunc(Number(term?.dueOn) || 0))
  let due: Date
  if (term?.paymentDue === 'Months') {
    const lastDay = new Date(year, month - 1 + steps + 1, 0).getDate()
    due = new Date(year, month - 1 + steps, Math.min(day, lastDay))
  } else {
    due = new Date(year, month - 1, day + steps)
  }
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`
}

export function lineAmount(line: Pick<SalesLineItem, 'quantity' | 'unitPrice'>): number {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100) / 100
}

export function postedReceiptsTotal(documents: SalesDocument[], invoiceId: string): number {
  return documents
    .filter((item) => item.kind === 'sales-receipts' && item.invoiceId === invoiceId && item.status === 'Posted')
    .reduce((sum, item) => sum + item.amount, 0)
}

/** Status shown for an invoice. Draft and Cancelled are kept; issued invoices are Paid or Unpaid by collections. */
export function invoiceStatus(invoice: SalesDocument, documents: SalesDocument[]): SalesDocument['status'] {
  if (invoice.status === 'Draft' || invoice.status === 'Cancelled') return invoice.status
  return invoice.amount > 0 && postedReceiptsTotal(documents, invoice.id) >= invoice.amount ? 'Paid' : 'Unpaid'
}
