import { z } from 'zod'
import { actions, modules } from '../../security/permissions.js'

const permission = z.object(Object.fromEntries(actions.map((action) => [action, z.boolean()]))).strict()
export const roleSchema = z.object({
  name: z.string().trim().min(1).max(80), description: z.string().trim().max(200).default(''),
  active: z.boolean(), system: z.boolean().optional(),
  permissions: z.object(Object.fromEntries(modules.map((module) => [module, permission]))).strict(),
}).strict().refine((role) => modules.every((module) => role.permissions[module].view || !actions.some((action) => role.permissions[module][action])), 'Enable view before other permissions.')
export const userSchema = z.object({
  username: z.string().trim().regex(/^[a-z0-9._@+-]{3,254}$/i),
  email: z.union([z.literal(''), z.email()]).default(''), name: z.string().trim().min(1).max(160),
  roleId: z.string().min(1).max(100), active: z.boolean(), password: z.string().min(12).max(128).optional(),
}).strict()
