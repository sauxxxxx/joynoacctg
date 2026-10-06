import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { toInvoiceDraft } from '../features/sales/salesFormTypes'
import type { SalesDocument } from '../features/sales/salesPreviewStore'
import { buildPayableRows } from '../features/purchases/reports/purchaseReportData'
import type { PurchaseRecord } from '../features/purchases/purchasePreviewData'

describe('persisted financial document views', () => {
  it('opens a Vue-reactive invoice without changing its source or losing its version', () => {
    const record = reactive({ id: 'invoice', version: 4, kind: 'sales-invoices', number: 'SI-1', date: '2026-10-06', customerId: 'customer', status: 'Unpaid', paymentTermId: 'term', paymentMethodId: '', dueDate: '2026-10-06', amountCents: 10000, remarks: '', customerDetails: { customerType: 'Company', company: 'Customer', tin: '', street: '', locality: '', country: '', zipCode: '' }, discountTypeId: '', discountRate: 0, discountAmountCents: 0, lines: [{ id: 'line', itemId: '', description: 'Item', quantity: 1, unitPriceCents: 10000, withholdingTaxCode: '', withholdingTaxCents: 0, vatCode: '', vatType: '', vatCents: 0, creditableVatCents: 0 }], payments: [], withInvoice: false } as SalesDocument)
    const draft = toInvoiceDraft(record)
    expect(draft.version).toBe(4)
    draft.lines[0]!.unitPrice = 50
    draft.customerDetails.company = 'Changed'
    expect(record.lines[0]!.unitPriceCents).toBe(10000)
    expect(record.customerDetails.company).toBe('Customer')
  })
  it('payable aging excludes drafts and voids and ignores payments after the report date', () => {
    const invoice = { id: 'invoice', kind: 'purchase-invoices', date: '2026-09-01', dueDate: '2026-09-15', status: 'Posted', totalCents: 10000, vendorId: 'vendor' } as PurchaseRecord
    const payment = { id: 'payment', kind: 'cash-voucher', date: '2026-10-02', status: 'Posted', allocations: [{ id: 'row', invoiceId: 'invoice', others: '', amountCents: 3000 }] } as PurchaseRecord
    const rows = [invoice, payment, { ...invoice, id: 'draft', status: 'Draft' as const }, { ...invoice, id: 'voided', status: 'Voided' as const }]
    expect(buildPayableRows(rows, '2026-09-30', () => 'Vendor')).toEqual([expect.objectContaining({ balanceCents: 10000, oneToThirtyCents: 10000 })])
    expect(buildPayableRows(rows, '2026-10-06', () => 'Vendor')[0]?.balanceCents).toBe(7000)
    expect(buildPayableRows([invoice, { ...payment, status: 'Voided' }], '2026-10-06', () => 'Vendor')[0]?.balanceCents).toBe(10000)
  })
})
