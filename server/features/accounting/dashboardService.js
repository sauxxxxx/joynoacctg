import { Router } from 'express'
import { authorizeCompany } from '../../security/authorize.js'
import { sendData, ApiFailure } from '../../http/errors.js'
import { presentAudit } from '../company/auditPresenter.js'

const exact = (raw) => {
  const value = Number(raw)
  if (!Number.isSafeInteger(value)) throw new ApiFailure('VALIDATION_ERROR', 422, 'The total exceeds the supported reporting range.')
  return value
}
export function dashboardRoutes(db) {
  const router = Router({ mergeParams: true })
  router.get('/', authorizeCompany(db, 'Accounting', 'view'), async (req, res) => {
    const companyId = req.auth.companyId
    const company = (await db.query('SELECT name FROM companies WHERE id = $1', [companyId])).rows[0]
    const { rows } = await db.query(`SELECT a.id, a.code, a.type, j.entry_date, SUM(l.debit_cents) AS debit, SUM(l.credit_cents) AS credit
      FROM journal_lines l JOIN journal_entries j ON j.id = l.journal_entry_id AND j.company_id = l.company_id
      JOIN accounts a ON a.id = l.account_id AND a.company_id = l.company_id
      WHERE l.company_id = $1 AND j.status = 'Posted' GROUP BY a.id, a.code, a.type, j.entry_date`, [companyId])
    const mapping = (await db.query("SELECT payload FROM company_settings WHERE company_id = $1 AND kind = 'mappings'", [companyId])).rows[0]
    const mappings = mapping ? JSON.parse(mapping.payload).rows : []
    const balance = (label, normal) => {
      const account = mappings.find((row) => row.label === label)?.accountId
      if (!account) return null
      const total = rows.filter((row) => row.id === account || row.code === account).reduce((sum, row) => sum + exact(row.debit) - exact(row.credit), 0)
      return exact(normal === 'credit' ? -total : total)
    }
    let revenueCents = 0
    let expensesCents = 0
    const months = new Map()
    for (const row of rows) {
      const month = row.entry_date.slice(0, 7)
      if (!months.has(month)) months.set(month, { month, revenueCents: 0, expenseCents: 0 })
      if (row.type === 'Revenue') { const amount = exact(row.credit) - exact(row.debit); revenueCents += amount; months.get(month).revenueCents += amount }
      if (row.type === 'Expense') { const amount = exact(row.debit) - exact(row.credit); expensesCents += amount; months.get(month).expenseCents += amount }
    }
    const pending = Number((await db.query("SELECT COUNT(*) AS count FROM journal_entries WHERE company_id = $1 AND status = 'Draft'", [companyId])).rows[0].count)
    const activities = (await db.query('SELECT * FROM audit_events WHERE company_id = $1 ORDER BY created_at DESC, id LIMIT 100', [companyId])).rows.map(presentAudit).filter((event) => req.auth.permissions[event.module]?.view).slice(0, 8)
    const taxRecords = req.auth.permissions.Government?.view
      ? (await db.query("SELECT id, payload FROM company_records WHERE company_id = $1 AND kind IN ('tax-forms', 'yearly-tax-forms')", [companyId])).rows : []
    const deadlines = taxRecords.map((row) => ({ id: row.id, ...JSON.parse(row.payload) })).filter((row) => row.status === 'Draft')
      .map((row) => ({ id: row.id, form: row.formId.replace('form-', '').toUpperCase(), dueDate: row.dueDate || row.deadline, detail: `${row.year}${row.period ? ' · ' + row.period : ''} · Recorded deadline` }))
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id)).slice(0, 12)
    sendData(req, res, { companyName: company.name, sourceLabel: 'Posted entries', bankBalanceCents: balance('Cash', 'debit'), receivablesCents: balance('Accounts Receivable', 'debit'), payablesCents: balance('Accounts Payable', 'credit'),
      revenueCents: exact(revenueCents), expensesCents: exact(expensesCents), unjournalizedCount: pending,
      trends: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-6), deadlines, activities })
  })
  return router
}
