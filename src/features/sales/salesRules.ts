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
  amountCents: number
  paidCents: number
  balanceCents: number
}

/**
 * Splits an invoice into its payment-term installments and applies collections to the earliest ones first.
 * Assumptions pending confirmation: the invoice total is divided equally (the last installment takes the centavo
 * remainder), and a receipt is not tied to a particular installment.
 * Without a term the whole invoice is one installment due on `fallbackDueDate`.
 */
export function receivableInstallments(
  invoiceTotalCents: number,
  invoiceDate: string,
  term: TermSchedule | undefined,
  collectedCents: number,
  fallbackDueDate = '',
): ReceivableInstallment[] {
  const schedule = term ? paymentSchedule(term, invoiceDate) : []
  const dates = schedule.length ? schedule : fallbackDueDate ? [{ number: 1, dueDate: fallbackDueDate }] : []
  if (!dates.length) return []
  const totalCentavos = Math.max(0, Math.trunc(invoiceTotalCents))
  const share = Math.floor(totalCentavos / dates.length)
  let remainingCollected = Math.max(0, Math.trunc(collectedCents))
  return dates.map((item, index) => {
    const amount = index === dates.length - 1 ? totalCentavos - share * index : share
    const paid = Math.min(amount, remainingCollected)
    remainingCollected -= paid
    return { ...item, count: dates.length, amountCents: amount, paidCents: paid, balanceCents: amount - paid }
  })
}

export function frequencyLabel(term: Pick<SetupRecord, 'payments' | 'frequencyEvery' | 'frequencyUnit'>): string {
  return term.payments > 1 && term.frequencyUnit && term.frequencyEvery > 0 ? `Every ${term.frequencyEvery} ${term.frequencyUnit.toLocaleLowerCase()}` : ''
}

export function lineAmountCents(line: Pick<SalesLineItem, 'quantity' | 'unitPriceCents'>): number {
  return Math.round((Number(line.quantity) || 0) * (Number(line.unitPriceCents) || 0))
}

export interface SalesFinancialLine {
  quantity: number
  unitPriceCents: number
  withholdingTaxCents: number
  vatCents: number
  creditableVatCents: number
}

export function summarizeSalesLines(lines: SalesFinancialLine[]) {
  return lines.reduce((sum, line) => ({
    quantity: sum.quantity + (Number(line.quantity) || 0),
    withholdingCents: sum.withholdingCents + Math.trunc(Number(line.withholdingTaxCents) || 0),
    vatCents: sum.vatCents + Math.trunc(Number(line.vatCents) || 0),
    creditableVatCents: sum.creditableVatCents + Math.trunc(Number(line.creditableVatCents) || 0),
    amountCents: sum.amountCents + lineAmountCents(line),
  }), { quantity: 0, withholdingCents: 0, vatCents: 0, creditableVatCents: 0, amountCents: 0 })
}

export function calculateDiscountCents(subtotalCents: number, computation: 'Amount' | 'Percentage', value: number): number {
  const raw = computation === 'Percentage' ? Math.round(subtotalCents * value / 100) : Math.trunc(value)
  return Math.min(Math.max(0, Math.trunc(subtotalCents)), Math.max(0, raw))
}

/** Sum of posted receipt rows that pay this invoice, optionally only receipts dated on or before `asOf`. */
export function postedReceiptsTotalCents(documents: SalesDocument[], invoiceId: string, asOf?: string): number {
  return documents
    .filter((item) => item.kind === 'sales-receipts' && item.status === 'Posted' && (!asOf || item.date <= asOf))
    .flatMap((item) => item.payments)
    .filter((row) => row.invoiceId === invoiceId)
    .reduce((sum, row) => sum + (Number(row.amountCents) || 0), 0)
}

export function invoiceBalanceCents(documents: SalesDocument[], invoice: SalesDocument): number {
  return Math.max(0, invoice.amountCents - postedReceiptsTotalCents(documents, invoice.id))
}

/** Status shown for an invoice. Draft and Cancelled are kept; issued invoices are Paid or Unpaid by collections. */
export function invoiceStatus(invoice: SalesDocument, documents: SalesDocument[]): SalesDocument['status'] {
  if (invoice.status === 'Draft' || invoice.status === 'Cancelled') return invoice.status
  return invoice.amountCents > 0 && invoiceBalanceCents(documents, invoice) === 0 ? 'Paid' : 'Unpaid'
}
