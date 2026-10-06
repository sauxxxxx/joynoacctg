import { requireRelatedRecord } from '../records/references.js'
import { jsonRecordRepository } from '../records/jsonRecordRepository.js'
import { assertOpenPeriod } from '../accounting/journalService.js'
import { exact, invalid, lineTotal, percentageOf, stateError, sum, validateAllocations } from './documentMath.js'
import { assignDocumentNumber } from './documentNumbering.js'

export async function validateDocument(value, previous, records, tx, context, domain) {
  if (previous?.journalEntryId || previous && ['Posted', 'Cancelled', 'Voided'].includes(previous.status)) throw stateError('Posted and cancelled documents are read-only. Use the void action to preserve their history.')
  if (value.journalEntryId || ['Paid', 'Posted', 'Cancelled', 'Voided'].includes(value.status)) throw stateError('Post or void a document through its actions, not by changing its status.')
  if (previous && value.kind !== previous.kind) throw invalid('The document category cannot change.')
  await assertOpenPeriod(tx, context.companyId, value.date)
  if (Number(value.date.slice(0, 4)) < 1900) throw invalid('Use a document date from 1900 onward.')
  if (!value.number && !previous && domain === 'sales-documents') await assignDocumentNumber(tx, context, value, records)
  if (!value.number) throw invalid('Enter a document reference number.')
  if (records.some((record) => record.id !== previous?.id && record.kind === value.kind && record.number.toLowerCase() === value.number.toLowerCase())) throw invalid('That document reference number is already in use.')
  if (domain === 'sales-documents') {
    await requireRelatedRecord(tx, context.companyId, 'customers', value.customerId)
    if (value.kind === 'sales-invoices') {
      if (!value.lines.length || value.payments.length) throw invalid('An invoice needs line items, not receipt allocations.')
      const subtotal = sum(value.lines.map(lineTotal))
      if (value.discountTypeId) {
        const discount = await requireRelatedRecord(tx, context.companyId, 'sales-setup', value.discountTypeId, 'sales-discount-types')
        if (!discount.allowOverride) { value.discountRate = discount.computation === 'Percentage' ? discount.rate : 0; value.discountAmountCents = discount.computation === 'Amount' ? exact(Math.round(discount.rate * 100)) : 0 }
        if (discount.computation === 'Percentage') value.discountAmountCents = percentageOf(subtotal, value.discountRate)
      } else { value.discountRate = 0; value.discountAmountCents = 0 }
      if (value.discountAmountCents > subtotal) throw invalid('Discount cannot exceed the invoice subtotal.')
      value.amountCents = exact(subtotal - value.discountAmountCents + sum(value.lines.map((line) => line.vatCents)))
      const term = await requireRelatedRecord(tx, context.companyId, 'sales-setup', value.paymentTermId, 'sales-payment-terms')
      value.dueDate = dueDate(value.date, term.dueOn, term.paymentDue)
      for (const line of value.lines.filter((line) => line.itemId)) {
        const kinds = ['good', 'service', 'item']
        const choices = await Promise.all(kinds.map((kind) => jsonRecordRepository(tx, kind).get(context.companyId, line.itemId)))
        if (!choices.some((item) => item?.active)) throw invalid('Choose an active company item.')
      }
      value.paymentMethodId = ''; value.withInvoice = false
      value.status = value.status === 'Draft' ? 'Draft' : 'Unpaid'
    } else {
      if (value.lines.length || !value.payments.length) throw invalid('A receipt needs payment rows, not invoice lines.')
      await requireRelatedRecord(tx, context.companyId, 'sales-setup', value.paymentMethodId, 'sales-payment-methods')
      value.amountCents = sum(value.payments.map((row) => row.amountCents))
      value.status = value.kind === 'acknowledgement-receipts' ? 'Issued' : 'Draft'
      validateAllocations(value, records, domain)
    }
    if (!value.amountCents) throw invalid('The document total must be positive.')
  } else {
    if (value.custodianId) {
      if (!['cash-voucher', 'check-voucher', 'petty-cash-voucher'].includes(value.kind)) throw invalid('Only vouchers can record revolving fund movements.')
      await requireRelatedRecord(tx, context.companyId, 'purchase-setup', value.custodianId, 'revolving-fund-customers')
      if (!value.fundMovement) throw invalid('Choose replenishment or disbursement for the selected fund custodian.')
      if (value.fundMovement === 'Replenishment' && value.allocations.length) throw invalid('A fund replenishment cannot also settle vendor invoices.')
    } else if (value.fundMovement) throw invalid('Choose a fund custodian for this movement.')
    if (value.kind !== 'payrolls') await requireRelatedRecord(tx, context.companyId, 'purchase-setup', value.vendorId, 'vendors')
    else if (!/^\d{4}$/.test(value.year) || !/^(0?[1-9]|1[0-2])$/.test(value.month)) throw invalid('Choose a valid payroll month and year.')
    if (value.kind === 'purchase-invoices') {
      if (!value.lines.length || value.allocations.length) throw invalid('An invoice needs purchase lines, not payment allocations.')
      value.amountCents = sum(value.lines.map(lineTotal))
      value.dueDate ||= value.date
      if (value.dueDate < value.date) throw invalid('The due date cannot precede the invoice date.')
    } else if (value.lines.length) throw invalid('Use the amount field for this document type.')
    value.totalCents = exact(value.amountCents + value.taxCents)
    if (!value.totalCents) throw invalid('Enter a positive document total.')
    if (value.kind === 'check-voucher' && !value.checkNumber) throw invalid('Enter a check number.')
    if (value.kind === 'purchase-receipts' && !value.paymentMethod) throw invalid('Enter a payment method.')
    if (value.kind === 'purchase-invoices' || value.kind === 'payrolls') {
      if (value.allocations.length) throw invalid('Payable documents cannot allocate payments.')
    } else {
      validateAllocations(value, records, domain)
      if (sum(value.allocations.map((row) => row.amountCents)) > value.totalCents) throw invalid('Allocated payments cannot exceed this payment total.')
    }
    value.paidCents = 0; value.status = 'Draft'
  }
}

function dueDate(iso, steps, unit) {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  if (unit === 'Days') date.setUTCDate(date.getUTCDate() + steps)
  else {
    const offset = unit === 'Years' ? steps * 12 : steps
    date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth() + offset)
    date.setUTCDate(Math.min(day, new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()))
  }
  const result = date.toISOString().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw invalid('The calculated due date is outside the supported date range.')
  return result
}
