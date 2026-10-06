import { z } from 'zod'
export const MAX_FILE_BYTES = 10 * 1024 * 1024
export const COMPANY_QUOTA_BYTES = 500 * 1024 * 1024
export const uploadSchema = z.object({
  name: z.string().trim().min(1).max(160), fileName: z.string().trim().min(1).max(180).refine((value) => !/[\\/:]/.test(value) && [...value].every((character) => character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127), 'Use a filename, not a path.'),
  size: z.number().int().min(1).max(MAX_FILE_BYTES), category: z.enum(['Registration', 'Tax filing', 'Contract', 'Bank', 'Receipt', 'Other']),
  reference: z.string().trim().max(80).default(''), notes: z.string().trim().max(500).default(''),
}).strict()
export const documentListSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(25), search: z.string().max(200).default(''), archived: z.enum(['true', 'false']).default('false') }).strict()
