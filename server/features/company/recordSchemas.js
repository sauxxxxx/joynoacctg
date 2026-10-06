import { z } from 'zod'

const text = (max = 160) => z.string().trim().max(max).default('')
const name = z.string().trim().min(1).max(160)
const money = z.number().int().nonnegative().max(9_000_000_000_000)
const item = z.object({ kind: z.enum(['goods', 'services', 'others']), code: name.max(40), name, description: text(500),
  unit: text(30), sellingPriceCents: money, costCents: money, category: text(80), active: z.boolean() }).strict()
export const recordSchemas = {
  owner: z.object({ firstName: name.max(80), middleName: text(80), lastName: name.max(80), suffix: text(10),
    tin: z.string().regex(/^[\d-]*$/).max(20), email: z.union([z.literal(''), z.email()]), address: text(500), active: z.boolean() }).strict(),
  good: item, service: item, item,
  'message template': z.object({ name, channel: z.enum(['Email', 'SMS']), purpose: text(100), subject: text(300), body: z.string().trim().min(1).max(4000), active: z.boolean() }).strict(),
  series: z.object({ documentType: name.max(100), prefix: text(20), suffix: text(20), nextNumber: z.number().int().positive().max(1_000_000_000),
    padding: z.number().int().min(1).max(10), resetFrequency: z.enum(['Never', 'Yearly', 'Monthly']), active: z.boolean() }).strict(),
  'report template': z.object({ name, report: z.enum(['General Ledger (Detailed)', 'Trial Balance', 'Income Statement', 'Income Statement (Simplified)', 'Monthly Income Statement (Simplified)', 'Summary of Sales', 'Balance Sheet']), paperSize: z.enum(['A4', 'Letter', 'Legal']), orientation: z.enum(['Portrait', 'Landscape']),
    headerText: text(2000), footerText: text(2000), showSignatories: z.boolean(), isDefault: z.boolean() }).strict(),
}
