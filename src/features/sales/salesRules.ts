import type { PeriodUnit, SalesDocument, SalesLineItem, SetupRecord } from './salesPreviewStore'

/**
 * Sales rules shared by the invoice editor, receipts, payment terms, and reports.
 *
 * Assumptions pending confirmation:
 * - Month and year steps land on the same day, or the last day of the target month when that day does not exist
 *   (Jan 31 + 1 month = Feb 28/29).
 * - An invoice's due date is its first payment date under the payment term.
 * - An issued invoice shows as Paid once posted receipts allocated to it cover its total.
 * - Acknowledgement receipts do not reduce invoice balances.
 */

const pad = (value: number) => String(value).padStart(2, '0')
const toIso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export function addPeriod(iso: string, amount: number, unit: PeriodUnit): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [year, month, day] = iso.split('-').map(Number)
  const steps = Math.max(0, Math.trunc(Number(amount) || 0))
  if (unit === 'Days') return toIso(new Date(year, month - 1, day + steps))
  const monthOffset = unit === 'Years' ? steps * 12 : steps
  const lastDay = new Date(year, month - 1 + monthOffset + 1, 0).getDate()
  return toIso(new Date(year, month - 1 + monthOffset, Math.min(day, lastDay)))
}

type TermTiming = Pick<SetupRecord, 'dueOn' | 'paymentDue'>
type TermSchedule = TermTiming & Pick<SetupRecord, 'payments' | 'frequencyEvery' | 'frequencyUnit'>

export function computeDueDate(invoiceDate: string, term: TermTiming | undefined): string {
  return term ? addPeriod(invoiceDate, term.dueOn, term.paymentDue) : ''
}

export interface Installment {
  number: number
  dueDate: string
}

/** Due dates of each payment under a term, counted from an invoice date. */
export function paymentSchedule(term: TermSchedule, invoiceDate: string): Installment[] {
  const count = Math.max(1, Math.trunc(Number(term.payments) || 1))
  const first = addPeriod(invoiceDate, term.dueOn, term.paymentDue)
  if (!first) return []
  return Array.from({ length: count }, (_, index) => ({
    number: index + 1,
    // Counted from the first date, not the previous one, so month-end clamping never drifts.
    dueDate: index === 0 || !term.frequencyUnit ? first : addPeriod(first, term.frequencyEvery * index, term.frequencyUnit),
  }))
}

export interface ReceivableInstallment extends Installment {
  count: number
  amount: number
  paid: number
  balance: number
}

/**
 * Splits an invoice into its payment-term installments and applies collections to the earliest ones first.
 * Assumptions pending confirmation: the invoice total is divided equally (the last installment takes the centavo
 * remainder), and a receipt is not tied to a particular installment.
 * Without a term the whole invoice is one installment due on `fallbackDueDate`.
 */
export function receivableInstallments(
  invoiceTotal: number,
  invoiceDate: string,
  term: TermSchedule | undefined,
  collected: number,
  fallbackDueDate = '',
): ReceivableInstallment[] {
  const schedule = term ? paymentSchedule(term, invoiceDate) : []
  const dates = schedule.length ? schedule : fallbackDueDate ? [{ number: 1, dueDate: fallbackDueDate }] : []
  if (!dates.length) return []
  const totalCentavos = Math.round(Math.max(0, invoiceTotal) * 100)
  const share = Math.floor(totalCentavos / dates.length)
  let remainingCollected = Math.round(Math.max(0, collected) * 100)
  return dates.map((item, index) => {
    const amount = index === dates.length - 1 ? totalCentavos - share * index : share
    const paid = Math.min(amount, remainingCollected)
    remainingCollected -= paid
    return { ...item, count: dates.length, amount: amount / 100, paid: paid / 100, balance: (amount - paid) / 100 }
  })
}

export function frequencyLabel(term: Pick<SetupRecord, 'payments' | 'frequencyEvery' | 'frequencyUnit'>): string {
  return term.payments > 1 && term.frequencyUnit && term.frequencyEvery > 0 ? `Every ${term.frequencyEvery} ${term.frequencyUnit.toLocaleLowerCase()}` : ''
}

export function lineAmount(line: Pick<SalesLineItem, 'quantity' | 'unitPrice'>): number {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * 100) / 100
}

/** Sum of posted receipt rows that pay this invoice, optionally only receipts dated on or before `asOf`. */
export function postedReceiptsTotal(documents: SalesDocument[], invoiceId: string, asOf?: string): number {
  return documents
    .filter((item) => item.kind === 'sales-receipts' && item.status === 'Posted' && (!asOf || item.date <= asOf))
    .flatMap((item) => item.payments)
    .filter((row) => row.invoiceId === invoiceId)
    .reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
}

export function invoiceBalance(documents: SalesDocument[], invoice: SalesDocument): number {
  return Math.round(Math.max(0, invoice.amount - postedReceiptsTotal(documents, invoice.id)) * 100) / 100
}

/** Status shown for an invoice. Draft and Cancelled are kept; issued invoices are Paid or Unpaid by collections. */
export function invoiceStatus(invoice: SalesDocument, documents: SalesDocument[]): SalesDocument['status'] {
  if (invoice.status === 'Draft' || invoice.status === 'Cancelled') return invoice.status
  return invoice.amount > 0 && invoiceBalance(documents, invoice) === 0 ? 'Paid' : 'Unpaid'
}
