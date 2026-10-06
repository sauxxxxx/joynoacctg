import { z } from 'zod'
const text = (max = 160) => z.string().trim().max(max).default('')
export const bankTransactionSchema = z.object({ date: z.iso.date(), bankAccountId: z.string().min(1).max(100), direction: z.enum(['Receipt', 'Disbursement']),
  purpose: z.string().trim().min(1).max(120), partyType: z.enum(['Vendor', 'Customer', 'Employee', 'Other']), party: text(140),
  amountCents: z.number().int().safe().positive().max(9_000_000_000_000), status: z.enum(['Draft', 'Journalized', 'Voided']).default('Draft'),
  ledgerAccountId: z.string().min(1).max(100), reference: text(100), description: text(500), journalEntryId: text(100) }).strict()
export const bankQuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().max(200).default(''), status: z.enum(['Draft', 'Journalized', 'Voided']).optional(), bankAccountId: z.string().max(100).optional(),
  from: z.iso.date().optional(), to: z.iso.date().optional(), sortBy: z.enum(['date', 'amountCents', 'reference']).default('date'), sortDirection: z.enum(['asc', 'desc']).default('desc') }).strict()
export const sourcesSchema = z.object({ sourceIds: z.array(z.string().min(1).max(100)).min(1).max(200) }).strict()
  .refine((value) => new Set(value.sourceIds).size === value.sourceIds.length, 'Choose each source only once.')
