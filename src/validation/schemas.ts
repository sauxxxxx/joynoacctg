import { z } from 'zod'

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), 'Enter a valid date.')
export const utcTimestampSchema = z.string().datetime({ offset: true })
export const centsSchema = z.number().int().safe().nonnegative()
export const entityIdSchema = z.string().trim().min(1)
export const emailSchema = z.string().trim().email()

export const authCredentialsSchema = z.object({ username: z.string().trim().min(1, 'Enter your username or email.'), password: z.string().min(1, 'Enter your password.') })
export const roleSchema = z.object({ id: entityIdSchema, name: z.string().trim().min(1), active: z.boolean() })
export const userSchema = z.object({ id: entityIdSchema, username: z.string().trim().min(1), email: emailSchema, roleId: entityIdSchema, active: z.boolean() })
export const partySchema = z.object({ id: entityIdSchema, name: z.string().trim().min(1).max(160), tin: z.string().trim().max(32).optional(), email: z.union([emailSchema, z.literal('')]).optional() })

export const salesDocumentSchema = z.object({ id: entityIdSchema, customerId: entityIdSchema, date: isoDateSchema, amountCents: centsSchema, paymentTermId: z.string(), paymentMethodId: z.string() })
export const purchaseDocumentSchema = z.object({ id: entityIdSchema, vendorId: entityIdSchema, date: isoDateSchema, totalCents: centsSchema, paidCents: centsSchema }).refine((value) => value.paidCents <= value.totalCents, { path: ['paidCents'], message: 'Paid amount cannot exceed the total.' })
export const journalLineSchema = z.object({ accountId: entityIdSchema, debitCents: centsSchema, creditCents: centsSchema }).refine((line) => (line.debitCents > 0) !== (line.creditCents > 0), 'Enter exactly one side of the line.')
export const journalEntrySchema = z.object({ id: entityIdSchema, date: isoDateSchema, lines: z.array(journalLineSchema).min(2) }).refine((entry) => entry.lines.reduce((sum, line) => sum + line.debitCents, 0) === entry.lines.reduce((sum, line) => sum + line.creditCents, 0), { path: ['lines'], message: 'Debits and credits must balance.' })

export const bankAccountSchema = z.object({ id: entityIdSchema, name: z.string().trim().min(1), accountNumber: z.string().trim().min(1), ledgerAccountId: entityIdSchema, active: z.boolean() })
export const bankTransactionSchema = z.object({ id: entityIdSchema, date: isoDateSchema, bankAccountId: entityIdSchema, ledgerAccountId: entityIdSchema, amountCents: centsSchema.positive(), purpose: z.string().trim().min(1) })
export const fixedAssetSchema = z.object({ id: entityIdSchema, vendorId: entityIdSchema, datePurchased: isoDateSchema, description: z.string().trim().min(1), purchasePriceCents: centsSchema, salvageValueCents: centsSchema, usefulLifeMonths: z.number().int().positive(), lapsedMonths: z.number().int().nonnegative() }).refine((asset) => asset.salvageValueCents <= asset.purchasePriceCents, { path: ['salvageValueCents'], message: 'Salvage value cannot exceed purchase price.' })
export const taxRecordSchema = z.object({ id: entityIdSchema, date: isoDateSchema, amountCents: centsSchema, status: z.string().trim().min(1) })
export const taxCertificateSchema = taxRecordSchema.extend({ partyId: entityIdSchema, fromDate: isoDateSchema, toDate: isoDateSchema })
export const companySettingsSchema = z.object({ legalName: z.string().trim().min(1), tin: z.string().trim().min(1), fiscalYearStart: isoDateSchema })
export const documentMetadataSchema = z.object({ id: entityIdSchema, fileName: z.string().trim().min(1), mimeType: z.string().trim().min(1), sizeBytes: z.number().int().nonnegative(), createdAt: utcTimestampSchema })
