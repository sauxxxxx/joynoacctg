import type { AccountType, JournalSource, LedgerAccount, LedgerEntry } from './ledgerContract'

/**
 * Pure, deterministic report calculations. No Vue, no dates from the clock.
 *
 * Accounting conventions applied here (standard double-entry, not project-specific):
 * - Assets and expenses have debit normal balances; liabilities, equity and revenue have credit normal balances.
 * - A "normal balance" amount is positive when the account sits on its normal side.
 * - Only entries with status `posted` are included.
 *
 * Project assumptions (flagged, pending confirmation):
 * - The ledger has no closing entries. The balance sheet therefore shows cumulative
 *   revenue less expenses up to the as-of date as "Current earnings" inside equity.
 * - Statement grouping uses the account category supplied by Account Categories.
 *   Categories are ordered by their lowest account code.
 */

export const debitNormal: Record<AccountType, boolean> = {
  asset: true,
  expense: true,
  liability: false,
  equity: false,
  revenue: false,
}

export interface PostedLine {
  entryId: string
  entryNumber: string
  date: string
  source: JournalSource
  reference: string
  description: string
  accountId: string
  debitCents: number
  creditCents: number
}

export interface DateRange {
  from?: string
  to?: string
}

export const compareCodes = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

export function sortAccounts(accounts: LedgerAccount[]): LedgerAccount[] {
  return [...accounts].sort((a, b) => compareCodes(a.code, b.code))
}

export function postedLines(entries: LedgerEntry[]): PostedLine[] {
  return entries
    .filter((entry) => entry.status === 'posted')
    .flatMap((entry) => entry.lines.map((line) => ({
      entryId: entry.id,
      entryNumber: entry.entryNumber,
      date: entry.date,
      source: entry.source,
      reference: entry.reference,
      description: line.memo || entry.description,
      accountId: line.accountId,
      debitCents: line.debitCents,
      creditCents: line.creditCents,
    })))
    .sort((a, b) => a.date.localeCompare(b.date) || compareCodes(a.entryNumber, b.entryNumber))
}

export interface EntryIssue {
  entryNumber: string
  message: string
}

/** Posted entries that would make reports unreliable: unbalanced, unknown accounts, or invalid amounts. */
export function findEntryIssues(accounts: LedgerAccount[], entries: LedgerEntry[]): EntryIssue[] {
  const known = new Set(accounts.map((account) => account.id))
  const issues: EntryIssue[] = []
  for (const entry of entries) {
    if (entry.status !== 'posted') continue
    let difference = 0
    for (const line of entry.lines) {
      if (!known.has(line.accountId)) issues.push({ entryNumber: entry.entryNumber, message: `uses unknown account ${line.accountId}` })
      if (!Number.isInteger(line.debitCents) || !Number.isInteger(line.creditCents) || line.debitCents < 0 || line.creditCents < 0) {
        issues.push({ entryNumber: entry.entryNumber, message: 'has an invalid line amount' })
      }
      difference += line.debitCents - line.creditCents
    }
    if (difference !== 0) issues.push({ entryNumber: entry.entryNumber, message: 'debits and credits do not match' })
  }
  return issues
}

/**
 * Whole-month range for a YYYY-MM string. `-31` is a safe inclusive upper bound for
 * ISO date string comparison in every month, so no calendar math is needed.
 */
export function monthRange(month: string): Required<DateRange> {
  return { from: `${month}-01`, to: `${month}-31` }
}

export function inRange(date: string, range: DateRange): boolean {
  return (!range.from || date >= range.from) && (!range.to || date <= range.to)
}

export interface Totals {
  debitCents: number
  creditCents: number
}

export function totalsByAccount(lines: PostedLine[], range: DateRange = {}): Map<string, Totals> {
  const totals = new Map<string, Totals>()
  for (const line of lines) {
    if (!inRange(line.date, range)) continue
    const current = totals.get(line.accountId) ?? { debitCents: 0, creditCents: 0 }
    current.debitCents += line.debitCents
    current.creditCents += line.creditCents
    totals.set(line.accountId, current)
  }
  return totals
}

export function normalBalance(type: AccountType, totals: Totals | undefined): number {
  if (!totals) return 0
  return debitNormal[type] ? totals.debitCents - totals.creditCents : totals.creditCents - totals.debitCents
}

// ---------------------------------------------------------------- Trial balance

export interface TrialBalanceRow {
  account: LedgerAccount
  debitCents: number
  creditCents: number
}

export interface TrialBalance {
  rows: TrialBalanceRow[]
  totalDebitCents: number
  totalCreditCents: number
  differenceCents: number
}

/** Net balance of each account as of a date, shown on its debit or credit side. */
export function trialBalance(accounts: LedgerAccount[], lines: PostedLine[], asOf: string, includeZero: boolean): TrialBalance {
  const totals = totalsByAccount(lines, { to: asOf })
  const rows = sortAccounts(accounts).flatMap((account) => {
    const total = totals.get(account.id)
    const net = total ? total.debitCents - total.creditCents : 0
    if (net === 0 && !includeZero) return []
    return [{ account, debitCents: net > 0 ? net : 0, creditCents: net < 0 ? -net : 0 }]
  })
  const totalDebitCents = rows.reduce((sum, row) => sum + row.debitCents, 0)
  const totalCreditCents = rows.reduce((sum, row) => sum + row.creditCents, 0)
  return { rows, totalDebitCents, totalCreditCents, differenceCents: totalDebitCents - totalCreditCents }
}

// ---------------------------------------------------------------- General ledger

export interface LedgerRow {
  line: PostedLine
  /** Debit minus credit, cumulative from the opening balance. */
  runningCents: number
}

export interface LedgerSection {
  account: LedgerAccount
  /** Debit minus credit before the range start. */
  openingCents: number
  rows: LedgerRow[]
  periodDebitCents: number
  periodCreditCents: number
  closingCents: number
}

export function generalLedger(
  accounts: LedgerAccount[],
  lines: PostedLine[],
  options: { from: string; to: string; accountId?: string; includeInactive?: boolean },
): LedgerSection[] {
  return sortAccounts(accounts)
    .filter((account) => !options.accountId || account.id === options.accountId)
    .flatMap((account) => {
      const accountLines = lines.filter((line) => line.accountId === account.id)
      const openingCents = accountLines
        .filter((line) => line.date < options.from)
        .reduce((sum, line) => sum + line.debitCents - line.creditCents, 0)
      let running = openingCents
      const rows = accountLines
        .filter((line) => inRange(line.date, options))
        .map((line) => {
          running += line.debitCents - line.creditCents
          return { line, runningCents: running }
        })
      const hasActivity = rows.length > 0 || openingCents !== 0
      if (!hasActivity && !options.includeInactive && !options.accountId) return []
      return [{
        account,
        openingCents,
        rows,
        periodDebitCents: rows.reduce((sum, row) => sum + row.line.debitCents, 0),
        periodCreditCents: rows.reduce((sum, row) => sum + row.line.creditCents, 0),
        closingCents: running,
      }]
    })
}

// ---------------------------------------------------------------- Statements

export interface StatementAccountRow {
  account: LedgerAccount
  amountCents: number
}

export interface StatementGroup {
  category: string
  accounts: StatementAccountRow[]
  totalCents: number
}

export interface StatementSection {
  type: AccountType
  groups: StatementGroup[]
  totalCents: number
}

/** Normal-balance amounts for one account type, grouped by category. Zero accounts are omitted. */
export function statementSection(type: AccountType, accounts: LedgerAccount[], totals: Map<string, Totals>): StatementSection {
  const groups = new Map<string, StatementGroup>()
  for (const account of sortAccounts(accounts.filter((item) => item.type === type))) {
    const amountCents = normalBalance(type, totals.get(account.id))
    if (amountCents === 0) continue
    const group = groups.get(account.category) ?? { category: account.category, accounts: [], totalCents: 0 }
    group.accounts.push({ account, amountCents })
    group.totalCents += amountCents
    groups.set(account.category, group)
  }
  const list = [...groups.values()]
  return { type, groups: list, totalCents: list.reduce((sum, group) => sum + group.totalCents, 0) }
}

export interface IncomeStatement {
  revenue: StatementSection
  expenses: StatementSection
  netIncomeCents: number
}

export function incomeStatement(accounts: LedgerAccount[], lines: PostedLine[], range: Required<DateRange>): IncomeStatement {
  const totals = totalsByAccount(lines, range)
  const revenue = statementSection('revenue', accounts, totals)
  const expenses = statementSection('expense', accounts, totals)
  return { revenue, expenses, netIncomeCents: revenue.totalCents - expenses.totalCents }
}

export interface MonthlyRow {
  label: string
  values: number[]
  totalCents: number
}

export interface MonthlyIncomeStatement {
  months: string[]
  revenue: MonthlyRow[]
  expenses: MonthlyRow[]
  revenueTotals: MonthlyRow
  expenseTotals: MonthlyRow
  netIncome: MonthlyRow
}

/** Category totals per month. `months` are YYYY-MM strings. */
export function monthlyIncomeStatement(accounts: LedgerAccount[], lines: PostedLine[], months: string[]): MonthlyIncomeStatement {
  const perMonth = months.map((month) => incomeStatement(accounts, lines, monthRange(month)))
  const byCategory = (type: 'revenue' | 'expense') => {
    const categories: string[] = []
    for (const statement of perMonth) {
      const section = type === 'revenue' ? statement.revenue : statement.expenses
      for (const group of section.groups) if (!categories.includes(group.category)) categories.push(group.category)
    }
    const order = categoryOrder(accounts, type)
    categories.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
    return categories.map((category) => row(category, perMonth.map((statement) => {
      const section = type === 'revenue' ? statement.revenue : statement.expenses
      return section.groups.find((group) => group.category === category)?.totalCents ?? 0
    })))
  }
  return {
    months,
    revenue: byCategory('revenue'),
    expenses: byCategory('expense'),
    revenueTotals: row('Total revenue', perMonth.map((statement) => statement.revenue.totalCents)),
    expenseTotals: row('Total expenses', perMonth.map((statement) => statement.expenses.totalCents)),
    netIncome: row('Net income (loss)', perMonth.map((statement) => statement.netIncomeCents)),
  }
}

function row(label: string, values: number[]): MonthlyRow {
  return { label, values, totalCents: values.reduce((sum, value) => sum + value, 0) }
}

function categoryOrder(accounts: LedgerAccount[], type: AccountType): Map<string, number> {
  const order = new Map<string, number>()
  sortAccounts(accounts.filter((account) => account.type === type)).forEach((account, index) => {
    if (!order.has(account.category)) order.set(account.category, index)
  })
  return order
}

export interface BalanceSheet {
  assets: StatementSection
  liabilities: StatementSection
  equity: StatementSection
  /** Revenue less expenses up to the as-of date (see assumption above). */
  currentEarningsCents: number
  totalAssetsCents: number
  totalLiabilitiesAndEquityCents: number
  differenceCents: number
}

export function balanceSheet(accounts: LedgerAccount[], lines: PostedLine[], asOf: string): BalanceSheet {
  const totals = totalsByAccount(lines, { to: asOf })
  const assets = statementSection('asset', accounts, totals)
  const liabilities = statementSection('liability', accounts, totals)
  const equity = statementSection('equity', accounts, totals)
  const currentEarningsCents = statementSection('revenue', accounts, totals).totalCents - statementSection('expense', accounts, totals).totalCents
  const totalLiabilitiesAndEquityCents = liabilities.totalCents + equity.totalCents + currentEarningsCents
  return {
    assets,
    liabilities,
    equity,
    currentEarningsCents,
    totalAssetsCents: assets.totalCents,
    totalLiabilitiesAndEquityCents,
    differenceCents: assets.totalCents - totalLiabilitiesAndEquityCents,
  }
}

// ---------------------------------------------------------------- Analytics series

/** Month range, optionally ending early at `cap` (e.g. an as-of date inside the last month). */
function cappedMonth(month: string, cap?: string): Required<DateRange> {
  const range = monthRange(month)
  return cap && cap < range.to ? { from: range.from, to: cap } : range
}

/** Month-end normal balance for one account type (balance-sheet types). */
export function monthEndBalances(accounts: LedgerAccount[], lines: PostedLine[], type: AccountType, months: string[], cap?: string): number[] {
  return months.map((month) => statementSection(type, accounts, totalsByAccount(lines, { to: cappedMonth(month, cap).to })).totalCents)
}

/** Net activity per month for one account type, on its normal side (revenue and expense). */
export function monthlyActivity(accounts: LedgerAccount[], lines: PostedLine[], type: AccountType, months: string[], cap?: string): number[] {
  return months.map((month) => statementSection(type, accounts, totalsByAccount(lines, cappedMonth(month, cap))).totalCents)
}

/** Cumulative revenue less expenses at each month end. */
export function monthEndEarnings(accounts: LedgerAccount[], lines: PostedLine[], months: string[], cap?: string): number[] {
  const revenue = monthEndBalances(accounts, lines, 'revenue', months, cap)
  const expenses = monthEndBalances(accounts, lines, 'expense', months, cap)
  return revenue.map((value, index) => value - expenses[index])
}
