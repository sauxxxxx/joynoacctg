import { Router } from 'express'
import { z } from 'zod'
import { authorizeCompany } from '../../security/authorize.js'
import { ApiFailure } from '../../http/errors.js'

const labels = { general: 'General Journal', sales: 'Sales Journal', purchase: 'Purchase Journal', 'cash-receipt': 'Cash Receipt Journal', 'cash-disbursement': 'Cash Disbursement Journal' }
const date = z.union([z.literal(''), z.iso.date()]).default('')
const querySchema = z.object({ page: z.coerce.number().int().positive().default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20), search: z.string().max(200).default(''), from: date, to: date,
  source: z.enum(['', ...Object.keys(labels)]).default(''), sortBy: z.enum(['date', 'entryNumber', 'source', 'debitCents', 'creditCents']).default('date'), sortDirection: z.enum(['asc', 'desc']).default('desc') }).strict()
export async function postedBooks(db, companyId, query) {
  const parsed = querySchema.parse(query)
  if (parsed.from && parsed.to && parsed.from > parsed.to) throw new ApiFailure('VALIDATION_ERROR', 422, 'The end date must be on or after the start date.')
  const values = [companyId]
  const clauses = ["j.company_id = $1", "j.status = 'Posted'"]
  for (const [value, column, operator] of [[parsed.from, 'entry_date', '>='], [parsed.to, 'entry_date', '<='], [parsed.source ? `${parsed.source}-journal` : '', 'kind', '=']]) {
    if (value) { values.push(value); clauses.push(`j.${column} ${operator} $${values.length}`) }
  }
  if (parsed.search) {
    values.push(`%${parsed.search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
    clauses.push(`lower(CAST(j.journal_number AS TEXT) || ' ' || j.reference_number || ' ' || j.remarks) LIKE $${values.length} ESCAPE '\\'`)
  }
  const where = clauses.join(' AND ')
  const total = Number((await db.query(`SELECT COUNT(*) AS count FROM journal_entries j WHERE ${where}`, values)).rows[0].count)
  const columns = { date: 'j.entry_date', entryNumber: 'j.journal_number', source: 'j.kind', debitCents: 'debit_total', creditCents: 'credit_total' }
  const rows = (await db.query(`SELECT j.id, j.kind, j.journal_number, j.entry_date, j.reference_number, j.remarks,
    SUM(l.debit_cents) AS debit_total, SUM(l.credit_cents) AS credit_total
    FROM journal_entries j JOIN journal_lines l ON l.company_id = j.company_id AND l.journal_entry_id = j.id
    WHERE ${where} GROUP BY j.id, j.kind, j.journal_number, j.entry_date, j.reference_number, j.remarks
    ORDER BY ${columns[parsed.sortBy]} ${parsed.sortDirection === 'asc' ? 'ASC' : 'DESC'}, j.id
    LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, parsed.pageSize, (parsed.page - 1) * parsed.pageSize])).rows
  const data = rows.map((row) => {
    const source = row.kind.replace('-journal', '')
    return { id: row.id, bookType: labels[source], source, sourceLabel: labels[source], entryNumber: String(row.journal_number), date: row.entry_date, reference: row.reference_number, description: row.remarks, debitCents: Number(row.debit_total), creditCents: Number(row.credit_total) }
  })
  return { data, page: parsed.page, pageSize: parsed.pageSize, total, totalPages: Math.max(1, Math.ceil(total / parsed.pageSize)) }
}
export function booksRoutes(db) {
  const router = Router({ mergeParams: true })
  router.get('/', authorizeCompany(db, 'Government', 'view'), async (req, res) => res.json({ ...await postedBooks(db, req.auth.companyId, req.query), requestId: req.requestId }))
  return router
}
