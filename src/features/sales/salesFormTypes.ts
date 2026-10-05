import type { SalesDocument, SalesLineItem } from './salesPreviewStore'

export interface SalesLineDraft {
  id: string
  itemId: string
  description: string
  quantity: number
  unitPrice: number
  withholdingTaxCode: string
  withholdingTaxAmount: number
  vatCode: string
  vatType: string
  vatAmount: number
  creditableVatAmount: number
}

export type SalesInvoiceDraft = Omit<SalesDocument, 'lines' | 'amountCents' | 'discountAmountCents'> & {
  lines: SalesLineDraft[]
  amountCents: number
  discountAmountCents: number
  discountInput: number
}

const pesos = (cents: number) => cents / 100

export function toSalesLineDraft(line: SalesLineItem): SalesLineDraft {
  return {
    id: line.id, itemId: line.itemId, description: line.description, quantity: line.quantity, unitPrice: pesos(line.unitPriceCents),
    withholdingTaxCode: line.withholdingTaxCode, withholdingTaxAmount: pesos(line.withholdingTaxCents),
    vatCode: line.vatCode, vatType: line.vatType, vatAmount: pesos(line.vatCents), creditableVatAmount: pesos(line.creditableVatCents),
  }
}

export function toInvoiceDraft(invoice: SalesDocument): SalesInvoiceDraft {
  return {
    ...structuredClone(invoice), lines: invoice.lines.map(toSalesLineDraft),
    discountInput: invoice.discountAmountCents ? pesos(invoice.discountAmountCents) : invoice.discountRate,
  }
}
