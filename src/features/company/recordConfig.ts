import type { Ref } from 'vue'
import type { ZodType } from 'zod'
import type { SelectOption } from '../../components/ui/AppSelect.vue'

export type AnyRecord = { id: string; [key: string]: unknown }

export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'percent' | 'email' | 'date' | 'select' | 'checkbox'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  required?: boolean
  options?: () => SelectOption[]
  placeholder?: string
  hint?: string
  full?: boolean
  maxlength?: number
  min?: number
  max?: number
  step?: number
  /** Starts a titled group of fields (settings forms). */
  section?: string
  /** Show the field only when this returns true for the current draft. */
  when?: (draft: AnyRecord) => boolean
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'muted'

export interface ColumnDef {
  label: string
  value: (record: AnyRecord) => string
  sub?: (record: AnyRecord) => string
  numeric?: boolean
  strong?: boolean
  badge?: (record: AnyRecord) => { text: string; tone: BadgeTone }
  /** Shows a read-only checkbox, like the legacy Active? columns. */
  check?: (record: AnyRecord) => boolean
}

export interface RecordsConfig {
  /** Singular noun, lower case: "owner". */
  singular: string
  /** Plural noun, lower case: "owners". */
  plural: string
  description: string
  /** Panel title when it differs from the singular noun, e.g. "Company User Roles". */
  heading?: string
  /** Assumptions or limits the reader should know. Shown above the list. */
  note?: string
  store: Ref<AnyRecord[]>
  auditModule: string
  empty: () => Omit<AnyRecord, 'id'>
  fields: FieldDef[]
  columns: ColumnDef[]
  schema: ZodType
  label: (record: AnyRecord) => string
  searchText: (record: AnyRecord) => string
  /** Cross-record rules (uniqueness, totals). Return an error message or ''. */
  validate?: (draft: AnyRecord, others: AnyRecord[]) => string
  /** Reason the record cannot be deleted, or ''. */
  deleteBlocker?: (record: AnyRecord) => string
  /** Live preview shown under the form, e.g. a rendered message. */
  preview?: (draft: AnyRecord) => { heading: string; body: string } | null
  footer?: (records: AnyRecord[]) => string
  /** Convert a stored domain record to an editable form model. */
  toDraft?: (record: AnyRecord) => AnyRecord
  /** Convert a validated form model back to its stored domain representation. */
  fromDraft?: (draft: AnyRecord) => AnyRecord
}

/** Lets each config keep its own record type while the page works with `AnyRecord`. */
export function defineRecords<T extends { id: string }>(config: Omit<RecordsConfig, 'store' | 'empty'> & { store: Ref<T[]>; empty: () => Omit<T, 'id'> }): RecordsConfig {
  return config as unknown as RecordsConfig
}

export const text = (record: AnyRecord, key: string) => {
  const value = record[key]
  return typeof value === 'string' && value.trim() ? value : '—'
}

export const activeBadge = (record: AnyRecord) => record.active
  ? { text: 'Active', tone: 'success' as const }
  : { text: 'Inactive', tone: 'muted' as const }

export const sameText = (a: unknown, b: unknown) =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase()

export const toOptions = (values: readonly string[]): SelectOption[] => values.map((value) => ({ value, label: value }))
