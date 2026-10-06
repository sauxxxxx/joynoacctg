import { z } from 'zod'
const text = (max = 240) => z.string().trim().max(max).default('')
const money = z.number().int().nonnegative().max(9_000_000_000_000)
export const kinds = ['general-journal', 'sales-journal', 'purchase-journal', 'cash-receipt-journal', 'cash-disbursement-journal']
export const journalSchema = z.object({
  kind: z.enum(kinds), journalNumber: text(20), referenceNumber: text(100), date: z.iso.date(), party: text(160),
  remarks: text(1000), createdBy: text(160), amountCents: money.optional(), status: z.enum(['Draft', 'Posted', 'Voided']).default('Draft'),
  journalType: z.enum(['Adjusting Entry', 'Reversing Entry', 'Beginning Balance', 'Closing Entry']).optional(), sourceKey: text(200).optional(),
  lines: z.array(z.object({ accountId: z.string().min(1).max(100), debitCents: money, creditCents: money, subsidiary: text(160), remarks: text(500) }).strict()).min(2).max(500),
}).strict()
export const journalListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  kind: z.enum(kinds).optional(), status: z.enum(['Draft', 'Posted', 'Voided']).optional(), from: z.iso.date().optional(), to: z.iso.date().optional(),
  search: text(200), sortBy: z.enum(['date', 'journalNumber']).default('date'), sortDirection: z.enum(['asc', 'desc']).default('desc') }).strict()
