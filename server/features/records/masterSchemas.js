import { z } from 'zod'
const text = (max = 160) => z.string().trim().max(max).default('')
const name = z.string().trim().min(1).max(160)
const money = z.number().int().safe().nonnegative().max(9_000_000_000_000)
const whole = z.number().int().min(0).max(1200)
const unit = z.enum(['Days', 'Months', 'Years'])
const date = z.union([z.literal(''), z.iso.date()]).default('')
const rate = z.number().finite().nonnegative().max(1_000_000_000)
export const masterModules = { customers: 'Sales', 'sales-setup': 'Sales', 'purchase-setup': 'Purchases', 'bank-accounts': 'Banking', 'fixed-assets': 'Asset Management' }
export const masterSchemas = {
  customers: z.object({ customerType: z.enum(['Company', 'Individual']), name, tradeName: text(), isDefault: z.boolean(), active: z.boolean(),
    unitBuilding: text(300), locality: text(300), country: text(80), zipCode: z.string().trim().regex(/^\d*$/).max(10), tin: z.string().trim().regex(/^[\d-]*$/).max(40),
    lineOfBusiness: text(200), withholding: z.boolean(), topWithholdingAgent: z.boolean(), contactPerson: text(160),
    email: z.union([z.literal(''), z.email()]).default(''), phone: text(40), fax: text(40) }).strict()
    .refine((value) => !value.isDefault || value.active, 'The default customer must be active.'),
  'sales-setup': z.object({ kind: z.enum(['sales-payment-terms', 'sales-payment-methods', 'sales-discount-types']), name, active: z.boolean(), accountId: text(100),
    payments: z.number().int().min(1).max(120), dueOn: whole, paymentDue: z.union([z.literal(''), unit]), frequencyEvery: whole,
    frequencyUnit: z.union([z.literal(''), unit]), computation: z.enum(['Amount', 'Percentage']), rate, allowOverride: z.boolean() }).strict()
    .refine((value) => value.kind !== 'sales-payment-terms' || value.paymentDue && (value.payments === 1 || value.frequencyUnit && value.frequencyEvery > 0), 'Choose payment units and a valid installment frequency.')
    .refine((value) => value.computation !== 'Percentage' || value.rate <= 100, 'Percentage rates cannot exceed 100.'),
  'purchase-setup': z.object({ kind: z.enum(['vendors', 'revolving-fund-customers', 'purchases-discount-types', 'purchases-payment-terms', 'purchases-payment-methods']),
    name, tin: z.string().trim().regex(/^[\d-]*$/).max(40), address: text(500), accountId: text(100), active: z.boolean(), computation: z.enum(['Amount', 'Percentage']),
    rate, allowOverride: z.boolean(), payments: z.number().int().min(1).max(120), frequency: text(60), dueOn: whole, paymentDue: z.enum(['Days', 'Months', 'Years']) }).strict()
    .refine((value) => value.computation !== 'Percentage' || value.rate <= 100, 'Percentage rates cannot exceed 100.'),
  'bank-accounts': z.object({ name: name.max(140), bank: text(140), accountNumber: text(80), ledgerAccountId: z.string().min(1).max(100), remarks: text(300), active: z.boolean() }).strict(),
  'fixed-assets': z.object({ salesInvoice: text(80), trackingNumber: text(80), datePurchased: z.iso.date(), description: name.max(240), vendorId: z.string().min(1).max(100),
    itemId: text(100), purchasePriceCents: money, vatCents: money, usefulLifeMonths: whole.min(1), salvageValueCents: money, remarks: text(1000),
    lapsedMonths: z.number().int().min(0).max(12000), warrantyExpirationDate: date }).strict()
    .refine((value) => value.salvageValueCents <= value.purchasePriceCents, 'Salvage value cannot exceed the purchase price.'),
}
export const masterQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).default(''), active: z.enum(['true', 'false']).optional(), kind: z.string().max(100).optional(),
  sortBy: z.enum(['name', 'trackingNumber', 'datePurchased']).default('name'), sortDirection: z.enum(['asc', 'desc']).default('asc') }).strict()
