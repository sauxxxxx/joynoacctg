import { ApiFailure } from '../../http/errors.js'
export const invalid = (message) => new ApiFailure('VALIDATION_ERROR', 422, message)
export const stateError = (message) => new ApiFailure('INVALID_STATE_TRANSITION', 409, message)
export function exact(value) {
  if (!Number.isSafeInteger(value) || value < 0 || value > 9_000_000_000_000) throw invalid('The amount is outside the supported range.')
  return value
}
export function lineTotal(line) {
  const product = BigInt(Math.round(line.quantity * 1e6)) * BigInt(line.unitPriceCents)
  return exact(Number((product + 500000n) / 1000000n))
}
export const sum = (values) => exact(values.reduce((total, value) => exact(total + value), 0))
export function percentageOf(amount, rate) {
  const scaled = Math.round(rate * 1e6)
  if (!Number.isSafeInteger(scaled) || scaled < 0 || scaled > 100_000_000 || Math.abs(rate * 1e6 - scaled) > 0.000001) throw invalid('Use a percentage from 0 to 100 with at most six decimal places.')
  const numerator = BigInt(scaled)
  const denominator = 100_000_000n
  return exact(Number((BigInt(amount) * numerator + denominator / 2n) / denominator))
}
export function allocated(records, invoiceId, domain, excludeId) {
  return sum(records.filter((record) => record.id !== excludeId && record.status === 'Posted' && (domain !== 'sales-documents' || record.kind === 'sales-receipts'))
    .flatMap((record) => domain === 'sales-documents' ? record.payments : record.allocations || []).filter((row) => row.invoiceId === invoiceId).map((row) => row.amountCents))
}
export function validateAllocations(value, records, domain, posting = false) {
  const rows = domain === 'sales-documents' ? value.payments : value.allocations
  if (new Set(rows.map((row) => row.invoiceId).filter(Boolean)).size !== rows.filter((row) => row.invoiceId).length) throw invalid('List each invoice only once.')
  for (const row of rows) {
    if (!row.invoiceId) {
      if ((domain === 'sales-documents' && (value.kind === 'sales-receipts' || value.withInvoice)) || !row.others) throw invalid('Choose an invoice or describe this payment.')
      continue
    }
    const invoice = records.find((record) => record.id === row.invoiceId && record.kind === (domain === 'sales-documents' ? 'sales-invoices' : 'purchase-invoices'))
    const partyKey = domain === 'sales-documents' ? 'customerId' : 'vendorId'
    if (!invoice || invoice[partyKey] !== value[partyKey] || ['Draft', 'Cancelled', 'Voided'].includes(invoice.status)) throw invalid('Choose an issued invoice for the same party.')
    if (value.date < invoice.date) throw invalid('A payment cannot precede its invoice date.')
    if (value.kind === 'acknowledgement-receipts') continue
    if (posting && !invoice.journalEntryId) throw stateError('Post the invoice journal before posting its payment.')
    const balance = (domain === 'sales-documents' ? invoice.amountCents : invoice.totalCents) - allocated(records, invoice.id, domain, value.id)
    if (row.amountCents > balance) throw invalid('This allocation exceeds the invoice balance. Reload the invoice before continuing.')
  }
}
