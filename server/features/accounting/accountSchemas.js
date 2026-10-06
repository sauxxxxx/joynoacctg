import { z } from 'zod'

const types = z.enum(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'])
const code = z.string().trim().regex(/^[A-Z0-9-]{1,24}$/, 'Use 1–24 uppercase letters, numbers, or hyphens.')
const common = {
  code,
  name: z.string().trim().min(1).max(120),
  parentCode: z.string().trim().max(24).default(''),
  remarks: z.string().trim().max(240).default(''),
  active: z.boolean().default(true),
}

export const accountSchema = z.object({
  ...common,
  parentCode: code,
  type: types,
  itr: z.string().trim().max(100).default(''),
  legalBasis: z.string().trim().max(160).default(''),
}).strict()

export const categorySchema = z.object({ ...common, accountType: types.optional() }).strict()
export const versionSchema = z.union([z.number(), z.string().regex(/^[1-9]\d*$/)]).pipe(z.coerce.number().int().safe().min(1))

export function listSchema(kind) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().trim().max(200).default(''),
    active: z.enum(['true', 'false']).optional(),
    sortBy: z.enum(kind === 'accounts' ? ['code', 'name', 'type'] : ['code', 'name']).default('code'),
    sortDirection: z.enum(['asc', 'desc']).default('asc'),
  }).strict()
}
