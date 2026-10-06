import { z } from 'zod'
const text = (max = 160) => z.string().trim().max(max).default('')
const money = z.number().int().safe().nonnegative().max(9_000_000_000_000)
const year = z.number().int().min(2000).max(2100)
const optionalDate = z.union([z.literal(''), z.iso.date()]).default('')
export const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const quarters = ['1st Quarter', '2nd Quarter', '3rd Quarter', '4th Quarter']
export const monthlyForms = ['form-2550m', 'form-0619e', 'form-0619f', 'form-1601c', 'form-1600vt']
export const quarterlyForms = ['form-2550q', 'form-1702q', 'form-1601eq', 'form-1601fq']
export const taxSchemas = {
  'tax-forms': z.object({ formId: z.enum([...monthlyForms, ...quarterlyForms]), year, status: z.enum(['Draft', 'Filed']),
    period: z.enum([...months, ...quarters]), taxDueCents: money, dueDate: z.iso.date(), entry: text(120), amendment: z.boolean() }).strict()
    .refine((value) => (monthlyForms.includes(value.formId) ? months : quarters).includes(value.period), 'Choose the correct period for this form.'),
  'yearly-tax-forms': z.object({ formId: z.enum(['form-1604c', 'form-1604e', 'form-1604f', 'form-1702rt', 'form-0605']), year,
    status: z.enum(['Draft', 'Filed']), amountCents: money, deadline: z.iso.date(), entry: text(120) }).strict(),
  'tax-certificates': z.object({ formId: z.enum(['form-2306', 'form-2307']), source: z.enum(['Purchase receipts', 'Purchase invoices', 'Sales receipts', 'Other']),
    party: z.string().trim().min(1).max(140), status: z.enum(['Draft', 'Received', 'Sent']), amountCents: money, date: z.iso.date(),
    fromDate: optionalDate, toDate: optionalDate, signedFile: text(120), tin: z.string().trim().regex(/^[\d-]*$/).max(40) }).strict()
    .refine((value) => !value.fromDate || !value.toDate || value.fromDate <= value.toDate, 'The end date must be on or after the start date.'),
}
