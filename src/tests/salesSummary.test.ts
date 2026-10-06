import { describe, expect, it } from 'vitest'
import { summarizeSales } from '../features/accounting/reports/salesSummary'
import type { SalesDocument } from '../features/sales/salesPreviewStore'

describe('sales summary source amounts', () => {
  it('reports net sales before entered VAT without treating VAT as a negative discount', () => {
    const invoice = { customerId: 'customer-1', date: '2026-10-06', amountCents: 11000, discountAmountCents: 1000, lines: [{ quantity: 1, unitPriceCents: 10000, vatCents: 2000, withholdingTaxCents: 500 }] } as SalesDocument
    const report = summarizeSales([invoice], 'customer', () => 'Customer')
    expect(report.total.grossCents).toBe(10000)
    expect(report.total.discountCents).toBe(1000)
    expect(report.total.netCents).toBe(9000)
    expect(report.total.vatCents).toBe(2000)
    expect(report.total.withholdingCents).toBe(500)
  })
})
