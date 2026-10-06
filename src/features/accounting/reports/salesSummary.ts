import type { SalesDocument } from '../../sales/salesPreviewStore'
import { lineAmountCents } from '../../sales/salesRules'

/**
 * Summary of Sales from Sales › Invoices.
 *
 * Recorded-value report rules:
 * - Included statuses: Unpaid and Paid. Draft is optional; Cancelled is never included.
 * - Gross sales = Σ quantity × unit price. Net sales = invoice total before tax (gross less discount),
 *   calculated from recorded line amounts and the saved discount.
 * - VAT and withholding are the amounts typed on each invoice line. They are listed as recorded and are
 *   not added to or deducted from net sales, because the invoice form does not define that treatment.
 */

export type SalesGrouping = 'customer' | 'month'

export interface SalesSummaryRow {
  key: string
  label: string
  invoiceCount: number
  grossCents: number
  discountCents: number
  netCents: number
  vatCents: number
  withholdingCents: number
}

export function includedInvoices(documents: SalesDocument[], range: { from: string; to: string }, includeDrafts: boolean): SalesDocument[] {
  const statuses = new Set<SalesDocument['status']>(includeDrafts ? ['Unpaid', 'Paid', 'Draft'] : ['Unpaid', 'Paid'])
  return documents.filter((item) => item.kind === 'sales-invoices' && statuses.has(item.status) && item.date >= range.from && item.date <= range.to)
}

export function summarizeSales(
  invoices: SalesDocument[],
  grouping: SalesGrouping,
  labelFor: (invoice: SalesDocument) => string,
): { rows: SalesSummaryRow[]; total: SalesSummaryRow } {
  const groups = new Map<string, SalesSummaryRow>()
  for (const invoice of invoices) {
    const key = grouping === 'month' ? invoice.date.slice(0, 7) : invoice.customerId
    const row = groups.get(key) ?? { key, label: labelFor(invoice), invoiceCount: 0, grossCents: 0, discountCents: 0, netCents: 0, vatCents: 0, withholdingCents: 0 }
    const gross = invoice.lines.reduce((sum, line) => sum + lineAmountCents(line), 0)
    const net = Math.max(0, gross - (invoice.discountAmountCents || 0))
    row.invoiceCount += 1
    row.grossCents += gross
    row.netCents += net
    row.discountCents += Math.max(0, gross - net)
    row.vatCents += invoice.lines.reduce((sum, line) => sum + line.vatCents, 0)
    row.withholdingCents += invoice.lines.reduce((sum, line) => sum + line.withholdingTaxCents, 0)
    groups.set(key, row)
  }
  const rows = [...groups.values()].sort((a, b) => grouping === 'month' ? a.key.localeCompare(b.key) : b.netCents - a.netCents || a.label.localeCompare(b.label))
  const total = rows.reduce<SalesSummaryRow>((sum, row) => ({
    ...sum,
    invoiceCount: sum.invoiceCount + row.invoiceCount,
    grossCents: sum.grossCents + row.grossCents,
    discountCents: sum.discountCents + row.discountCents,
    netCents: sum.netCents + row.netCents,
    vatCents: sum.vatCents + row.vatCents,
    withholdingCents: sum.withholdingCents + row.withholdingCents,
  }), { key: 'total', label: 'Total', invoiceCount: 0, grossCents: 0, discountCents: 0, netCents: 0, vatCents: 0, withholdingCents: 0 })
  return { rows, total }
}
