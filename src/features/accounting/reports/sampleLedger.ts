import type { JournalSource, LedgerAccount, LedgerEntry, LedgerSource } from './ledgerContract'
import { monthsEnding } from './reportPeriods'

/**
 * SAMPLE DATA ONLY. Lets the report and analytics pages be reviewed before Owner B's
 * journal service exists. Account codes, categories, and amounts are illustrative and
 * are not a recommended chart of accounts. Every entry is balanced by construction.
 */

const account = (code: string, name: string, type: LedgerAccount['type'], category: string): LedgerAccount =>
  ({ id: `sample-${code}`, code, name, type, category, active: true })

export const sampleAccounts: LedgerAccount[] = [
  account('1010', 'Cash on Hand', 'asset', 'Cash and Cash Equivalents'),
  account('1020', 'Cash in Bank', 'asset', 'Cash and Cash Equivalents'),
  account('1100', 'Accounts Receivable', 'asset', 'Trade and Other Receivables'),
  account('1200', 'Merchandise Inventory', 'asset', 'Inventories'),
  account('1500', 'Office Equipment', 'asset', 'Property and Equipment'),
  account('1510', 'Accumulated Depreciation – Office Equipment', 'asset', 'Property and Equipment'),
  account('2010', 'Accounts Payable', 'liability', 'Trade and Other Payables'),
  account('2020', 'Accrued Expenses', 'liability', 'Trade and Other Payables'),
  account('2500', 'Loans Payable', 'liability', 'Borrowings'),
  account('3010', "Owner's Capital", 'equity', "Owner's Equity"),
  account('3020', "Owner's Drawings", 'equity', "Owner's Equity"),
  account('4010', 'Sales – Merchandise', 'revenue', 'Sales'),
  account('4020', 'Service Income', 'revenue', 'Sales'),
  account('4500', 'Interest Income', 'revenue', 'Other Income'),
  account('5010', 'Cost of Goods Sold', 'expense', 'Cost of Sales'),
  account('6010', 'Salaries and Wages', 'expense', 'Operating Expenses'),
  account('6020', 'Rent Expense', 'expense', 'Operating Expenses'),
  account('6030', 'Utilities Expense', 'expense', 'Operating Expenses'),
  account('6040', 'Office Supplies Expense', 'expense', 'Operating Expenses'),
  account('6050', 'Depreciation Expense', 'expense', 'Operating Expenses'),
  account('7010', 'Interest Expense', 'expense', 'Finance Costs'),
  account('6090', 'Miscellaneous Expense', 'expense', 'Operating Expenses'),
]

// Seasonal multipliers keep sample amounts varied but reproducible.
const season = [0.92, 0.88, 1.04, 1.1, 0.97, 1.15, 1.02, 0.9, 1.08, 1.2, 1.12, 1.35]
const round = (cents: number) => Math.round(cents / 100) * 100

export function buildSampleEntries(todayValue: string): LedgerEntry[] {
  const months = monthsEnding(todayValue, 18)
  const entries: LedgerEntry[] = []
  const counters: Record<JournalSource, number> = { general: 0, sales: 0, purchase: 0, 'cash-receipt': 0, 'cash-disbursement': 0 }
  const prefixes: Record<JournalSource, string> = { general: 'GJ', sales: 'SJ', purchase: 'PJ', 'cash-receipt': 'CRJ', 'cash-disbursement': 'CDJ' }

  function add(source: JournalSource, date: string, reference: string, description: string, lines: [string, number, number][], status: LedgerEntry['status'] = 'posted') {
    if (date > todayValue) return
    counters[source] += 1
    entries.push({
      id: `sample-${source}-${counters[source]}`,
      entryNumber: `${prefixes[source]}-${String(counters[source]).padStart(4, '0')}`,
      date,
      source,
      reference,
      description,
      status,
      lines: lines.map(([code, debitCents, creditCents]) => ({ accountId: `sample-${code}`, debitCents, creditCents })),
    })
  }

  const first = months[0]
  add('general', `${first}-01`, 'OPEN-001', 'Owner capital contribution', [['1020', 150_000_000, 0], ['1010', 5_000_000, 0], ['3010', 0, 155_000_000]])
  add('general', `${first}-03`, 'LOAN-001', 'Bank loan proceeds', [['1020', 60_000_000, 0], ['2500', 0, 60_000_000]])
  add('cash-disbursement', `${first}-05`, 'CV-EQ-001', 'Purchase of office equipment', [['1500', 42_000_000, 0], ['1020', 0, 42_000_000]])

  let previousUtilities = 0
  months.forEach((month, index) => {
    const factor = season[Number(month.slice(5, 7)) - 1] ?? 1
    const growth = 1 + index * 0.015
    const sales = round(38_000_000 * factor * growth)
    const services = round(9_500_000 * (2 - factor) * growth)
    const cogs = round(sales * 0.58)
    const purchases = round(cogs * 1.04)
    const collections = round(sales * 0.82)
    const supplierPayments = round(purchases * 0.9)
    const salaries = round(11_800_000 * (1 + Math.floor(index / 6) * 0.04))
    const utilities = round(1_450_000 * factor)
    const supplies = round(420_000 + (index % 4) * 95_000)
    const interest = round(Math.max(60_000_000 - index * 3_000_000, 0) * 0.0075)
    const ref = month.replace('-', '')

    add('sales', `${month}-06`, `INV-${ref}-A`, 'Sales on account – merchandise', [['1100', sales, 0], ['4010', 0, sales]])
    add('cash-receipt', `${month}-09`, `OR-${ref}-S`, 'Cash service billings', [['1010', services, 0], ['4020', 0, services]])
    add('general', `${month}-10`, `COGS-${ref}`, 'Cost of merchandise sold', [['5010', cogs, 0], ['1200', 0, cogs]])
    add('purchase', `${month}-12`, `PINV-${ref}`, 'Merchandise purchases on account', [['1200', purchases, 0], ['2010', 0, purchases]])
    add('cash-receipt', `${month}-18`, `OR-${ref}-C`, 'Collections from customers', [['1020', collections, 0], ['1100', 0, collections]])
    add('cash-disbursement', `${month}-20`, `CV-${ref}-S`, 'Payments to suppliers', [['2010', supplierPayments, 0], ['1020', 0, supplierPayments]])
    add('cash-disbursement', `${month}-25`, `PAY-${ref}`, 'Payroll', [['6010', salaries, 0], ['1020', 0, salaries]])
    add('cash-disbursement', `${month}-05`, `CV-${ref}-R`, 'Office rent', [['6020', 6_500_000, 0], ['1020', 0, 6_500_000]])
    add('general', `${month}-28`, `ACR-${ref}`, 'Accrued utilities', [['6030', utilities, 0], ['2020', 0, utilities]])
    if (previousUtilities > 0) {
      add('cash-disbursement', `${month}-15`, `CV-${ref}-U`, 'Payment of accrued utilities', [['2020', previousUtilities, 0], ['1020', 0, previousUtilities]])
    }
    previousUtilities = utilities
    add('cash-disbursement', `${month}-14`, `PCV-${ref}`, 'Office supplies', [['6040', supplies, 0], ['1010', 0, supplies]])
    add('general', `${month}-28`, `DEP-${ref}`, 'Monthly depreciation', [['6050', 700_000, 0], ['1510', 0, 700_000]])
    if (index > 0 && interest > 0) {
      add('cash-disbursement', `${month}-03`, `LOAN-${ref}`, 'Loan amortization', [['2500', 3_000_000, 0], ['7010', interest, 0], ['1020', 0, 3_000_000 + interest]])
    }
    add('cash-receipt', `${month}-27`, `BANK-${ref}`, 'Bank interest earned', [['1020', 18_500, 0], ['4500', 0, 18_500]])
    if (index % 3 === 2) add('cash-disbursement', `${month}-22`, `DRW-${ref}`, 'Owner withdrawal', [['3020', 4_000_000, 0], ['1020', 0, 4_000_000]])
  })

  // Excluded from reports: shows that only posted entries count.
  const lastMonth = months[months.length - 1]
  add('general', `${lastMonth}-01`, 'DRAFT-001', 'Draft adjustment awaiting review', [['6090', 250_000, 0], ['1010', 0, 250_000]], 'draft')
  return entries
}

export function createSampleLedgerSource(todayValue: string): LedgerSource {
  return {
    label: 'Sample ledger data',
    isSample: true,
    loadAccounts: async () => sampleAccounts,
    loadEntries: async () => buildSampleEntries(todayValue),
  }
}
