import { describe, expect, it } from 'vitest'
import { calculateDiscountCents, invoiceBalanceCents, lineAmountCents, receivableInstallments, summarizeSalesLines } from '../features/sales/salesRules'
import type { SalesDocument } from '../features/sales/salesPreviewStore'

const invoice = { id: 'invoice-1', kind: 'sales-invoices', status: 'Unpaid', amountCents: 10001 } as SalesDocument
const receipt = { id: 'receipt-1', kind: 'sales-receipts', status: 'Posted', date: '2026-09-30', payments: [{ invoiceId: 'invoice-1', amountCents: 4001 }] } as SalesDocument

describe('sales totals', () => {
  it('keeps line and receipt totals in centavos', () => {
    expect(lineAmountCents({ quantity: 3, unitPriceCents: 333 })).toBe(999)
    expect(invoiceBalanceCents([invoice, receipt], invoice)).toBe(6000)
  })
  it('assigns installment remainders to the last payment', () => {
    const rows = receivableInstallments(10001, '2026-01-31', { dueOn: 0, paymentDue: 'Days', payments: 3, frequencyEvery: 1, frequencyUnit: 'Months' }, 3334)
    expect(rows.map((row) => row.amountCents)).toEqual([3333, 3333, 3335])
    expect(rows.reduce((sum, row) => sum + row.balanceCents, 0)).toBe(6667)
  })
  it('totals VAT and caps amount and percentage discounts', () => {
    const totals = summarizeSalesLines([
      { quantity: 2, unitPriceCents: 12_500, withholdingTaxCents: 500, vatCents: 3_000, creditableVatCents: 250 },
      { quantity: 1, unitPriceCents: 5_000, withholdingTaxCents: 100, vatCents: 600, creditableVatCents: 50 },
    ])
    expect(totals).toEqual({ quantity: 3, amountCents: 30_000, withholdingCents: 600, vatCents: 3_600, creditableVatCents: 300 })
    expect(calculateDiscountCents(totals.amountCents, 'Percentage', 12.5)).toBe(3_750)
    expect(calculateDiscountCents(totals.amountCents, 'Amount', 50_000)).toBe(30_000)
  })
})
