/**
 * Ledger data contract consumed by Accounting Reports & Analytics (Owner A).
 *
 * Owner B's Journal Entries and Chart of Accounts layer is expected to provide an
 * implementation of `LedgerSource`. Reports never create or change journal data;
 * they only read posted entries through this interface.
 *
 * Amounts are integer centavos so totals stay exact.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'

export interface LedgerAccount {
  id: string
  /** Account code from the Chart of Accounts. Used for sorting and display. */
  code: string
  name: string
  type: AccountType
  /** Account category name from Accounting Setup › Account Categories. Used for report grouping. */
  category: string
  active: boolean
}

export type JournalSource = 'general' | 'sales' | 'purchase' | 'cash-receipt' | 'cash-disbursement'

export interface LedgerLine {
  accountId: string
  debitCents: number
  creditCents: number
  memo?: string
}

export interface LedgerEntry {
  id: string
  entryNumber: string
  /** ISO date, YYYY-MM-DD. */
  date: string
  source: JournalSource
  reference: string
  description: string
  /** Only `posted` entries are included in reports. */
  status: 'draft' | 'posted' | 'void'
  lines: LedgerLine[]
}

export interface LedgerSource {
  /** Shown on reports so readers know where the numbers come from. */
  label: string
  /** True while reports run on sample data instead of the journal service. */
  isSample: boolean
  loadAccounts(): Promise<LedgerAccount[]>
  loadEntries(): Promise<LedgerEntry[]>
}

export const journalSourceLabels: Record<JournalSource, string> = {
  general: 'General Journal',
  sales: 'Sales Journal',
  purchase: 'Purchase Journal',
  'cash-receipt': 'Cash Receipt Journal',
  'cash-disbursement': 'Cash Disbursement Journal',
}

export const accountTypeLabels: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
}
