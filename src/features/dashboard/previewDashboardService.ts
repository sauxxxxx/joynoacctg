import { bankTransactionBackend } from '../banking/bankingData'
import { auditEvents, companyProfile } from '../company/companyStore'
import { purchaseRecords } from '../purchases/purchasePreviewData'
import { salesDocuments } from '../sales/salesPreviewStore'
import { createSampleLedgerSource } from '../accounting/reports/sampleLedger'
import type { LedgerAccount, LedgerEntry } from '../accounting/reports/ledgerContract'
import type { DashboardService, DashboardTrendPoint } from './dashboardContract'

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
const pad = (value: number) => String(value).padStart(2, '0')
const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

function balanceFor(entries: LedgerEntry[], accountId: string, side: 'debit' | 'credit') {
  return entries.flatMap((entry) => entry.lines).filter((line) => line.accountId === accountId)
    .reduce((sum, line) => sum + (side === 'debit' ? line.debitCents - line.creditCents : line.creditCents - line.debitCents), 0)
}

function typeTotal(entries: LedgerEntry[], accounts: LedgerAccount[], type: LedgerAccount['type']) {
  const ids = new Set(accounts.filter((account) => account.type === type).map((account) => account.id))
  return entries.flatMap((entry) => entry.lines).filter((line) => ids.has(line.accountId))
    .reduce((sum, line) => sum + (type === 'revenue' ? line.creditCents - line.debitCents : line.debitCents - line.creditCents), 0)
}

function trends(entries: LedgerEntry[], accounts: LedgerAccount[]): DashboardTrendPoint[] {
  const months = [...new Set(entries.map((entry) => entry.date.slice(0, 7)))].sort().slice(-6)
  return months.map((month) => {
    const monthEntries = entries.filter((entry) => entry.date.startsWith(month))
    return { month, revenueCents: typeTotal(monthEntries, accounts, 'revenue'), expenseCents: typeTotal(monthEntries, accounts, 'expense') }
  })
}

export const previewDashboardService: DashboardService = {
  async load() {
    await wait(160)
    const today = iso(new Date())
    const ledger = createSampleLedgerSource(today)
    const [accounts, allEntries] = await Promise.all([ledger.loadAccounts(), ledger.loadEntries()])
    const entries = allEntries.filter((entry) => entry.status === 'posted')
    const cashIds = accounts.filter((account) => account.code === '1010' || account.code === '1020').map((account) => account.id)
    const bankBalanceCents = cashIds.reduce((sum, id) => sum + balanceFor(entries, id, 'debit'), 0)
    const receivableId = accounts.find((account) => account.code === '1100')?.id ?? ''
    const payableId = accounts.find((account) => account.code === '2010')?.id ?? ''
    const recentLedger = entries.slice(-5).reverse()
    const activities = auditEvents.value.length
      ? auditEvents.value.slice(0, 5).map((event) => ({ id: event.id, at: event.at, action: event.action, reference: event.reference, module: event.module }))
      : recentLedger.map((entry) => ({ id: entry.id, at: `${entry.date}T08:00:00Z`, action: 'Posted', reference: entry.reference, module: 'Accounting' }))
    const dueYear = new Date().getFullYear()
    const dueMonth = new Date().getMonth() + 2
    const due = (day: number) => `${dueMonth > 12 ? dueYear + 1 : dueYear}-${pad(((dueMonth - 1) % 12) + 1)}-${pad(day)}`

    return {
      companyName: companyProfile.value.companyName || 'Joyno Inc.', sourceLabel: ledger.label,
      bankBalanceCents, receivablesCents: balanceFor(entries, receivableId, 'debit'), payablesCents: balanceFor(entries, payableId, 'credit'),
      revenueCents: typeTotal(entries, accounts, 'revenue'), expensesCents: typeTotal(entries, accounts, 'expense'),
      unjournalizedCount: bankTransactionBackend.all().filter((item) => item.status === 'Draft').length
        + purchaseRecords.value.filter((item) => item.status === 'Draft').length
        + salesDocuments.value.filter((item) => item.status === 'Draft').length,
      trends: trends(entries, accounts),
      deadlines: [
        { id: '2550m', form: '2550M', dueDate: due(20), detail: 'Monthly VAT declaration' },
        { id: '0619e', form: '0619-E', dueDate: due(10), detail: 'Expanded withholding tax' },
        { id: '1601c', form: '1601-C', dueDate: due(10), detail: 'Compensation withholding tax' },
      ].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      activities,
    }
  },
}
