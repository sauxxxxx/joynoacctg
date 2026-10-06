import { z } from 'zod'
export const text = (max = 160) => z.string().trim().max(max).default('')
export const money = z.number().int().safe().nonnegative().max(9_000_000_000_000)
export const quantity = z.number().positive().max(1_000_000).refine((value) => Math.abs(value * 1e6 - Math.round(value * 1e6)) < 0.001, 'Use at most six quantity decimal places.')
export const allocation = z.object({ id: text(100), invoiceId: text(100), others: text(300), amountCents: money.positive() }).strict()
const snapshot = z.object(Object.fromEntries(['customerType', 'company', 'tin', 'street', 'locality', 'country', 'zipCode'].map((key) => [key, text(300)]))).strict()
export const salesSchema = z.object({
  kind: z.enum(['sales-invoices', 'sales-receipts', 'acknowledgement-receipts']), number: text(80), date: z.iso.date(), customerId: z.string().min(1).max(100),
  status: z.enum(['Draft', 'Unpaid', 'Paid', 'Posted', 'Issued', 'Cancelled']), paymentTermId: text(100), paymentMethodId: text(100), dueDate: text(10),
  amountCents: money.default(0), remarks: text(1000), customerDetails: snapshot,
  discountTypeId: text(100), discountRate: z.number().min(0).max(100).default(0), discountAmountCents: money.default(0),
  lines: z.array(z.object({ id: text(100), itemId: text(100), description: z.string().trim().min(1).max(300), quantity, unitPriceCents: money,
    withholdingTaxCode: text(80), withholdingTaxCents: money, vatCode: text(80), vatType: text(80), vatCents: money, creditableVatCents: money }).strict()).max(500),
  payments: z.array(allocation).max(200), withInvoice: z.boolean(), journalEntryId: text(100),
}).strict()
export const purchaseSchema = z.object({
  kind: z.enum(['purchase-invoices', 'payrolls', 'cash-voucher', 'check-voucher', 'petty-cash-voucher', 'purchase-receipts']), number: text(80), date: z.iso.date(),
  vendorId: text(100), amountCents: money, totalCents: money.default(0), paidCents: money.default(0), status: z.enum(['Draft', 'Posted', 'Voided']),
  remarks: text(1000), paymentMethod: text(100), paymentTerms: text(100), checkNumber: text(80), taxCents: money,
  lines: z.array(z.object({ id: text(100), description: z.string().trim().min(1).max(300), quantity, unitPriceCents: money }).strict()).max(500),
  month: text(2), year: text(4), period: text(100), payrollFrequency: text(100), payGroup: text(100), accrualJE: text(100),
  allocations: z.array(allocation).max(200).default([]), journalEntryId: text(100), dueDate: z.union([z.literal(''), z.iso.date()]).default(''),
  custodianId: text(100), fundMovement: z.enum(['', 'Replenishment', 'Disbursement']).default(''),
}).strict()
export const documentSchemas = { 'sales-documents': salesSchema, purchases: purchaseSchema }
export const documentQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().max(200).default('') }).strict()
