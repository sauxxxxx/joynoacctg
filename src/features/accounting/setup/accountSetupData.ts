import { createCollectionStore } from '../../../services/collectionStore'
import { conflictError, createRepository, validationError } from '../../../services/repository'

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

/** Categories are referenced by their code, which cannot change after creation. */
export interface AccountCategory {
  id: string
  version?: number
  code: string
  name: string
  parentCode: string
  remarks: string
  active: boolean
  accountType?: AccountType
}

/** Other records reference an account by `id`. Preview samples use the account code as their ID. */
export interface Account {
  id: string
  version?: number
  code: string
  name: string
  /** Code of the parent category. */
  parentCode: string
  type: AccountType
  remarks: string
  active: boolean
  itr: string
  legalBasis: string
}

const category = (code: string, name: string, parentCode = ''): AccountCategory => ({ id: code, code, name, parentCode, remarks: '', active: true })
const account = (code: string, name: string, parentCode: string, type: AccountType, active = true): Account =>
  ({ id: code, code, name, parentCode, type, remarks: '', active, itr: '', legalBasis: '' })

// Preview samples. With an API configured these are not used.
const seedCategories: AccountCategory[] = [
  category('CUA', 'Current Assets'),
  category('CCE', 'Cash and Cash Equivalents', 'CUA'),
  category('CR', 'Current Receivables', 'CUA'),
  category('I', 'Inventories', 'CUA'),
  category('OCA', 'Other Current Assets', 'CUA'),
  category('NCA', 'Non-current Assets'),
  category('IA', 'Intangible Assets', 'NCA'),
  category('LTI', 'Long Term Investments', 'NCA'),
  category('CUL', 'Current Liabilities'),
  category('NCL', 'Non-current Liabilities'),
  category('CAP', 'Capital'),
  category('RE', 'Retained Earnings'),
  category('NOR', 'Non-operating Revenues'),
  category('OR', 'Operating Revenues'),
  category('COS', 'Cost of Sales'),
  category('FE', 'Financial Expenses'),
  category('IT', 'Income Taxes'),
  category('OE', 'Other Expenses'),
]

const seedAccounts: Account[] = [
  account('101', 'Cash', 'CCE', 'Asset'),
  account('102', 'Petty Cash Fund', 'CCE', 'Asset'),
  account('103', 'Accounts Receivable - Trade', 'CR', 'Asset'),
  account('104', 'Accounts Receivable - Others', 'CR', 'Asset', false),
  account('105', 'Merchandise Inventory', 'I', 'Asset', false),
  account('109', 'Advances to Employees', 'OCA', 'Asset'),
  account('110', 'Advances to Officers and Stockholders', 'OCA', 'Asset'),
  account('111', 'Advances to Suppliers and/or Contractors', 'OCA', 'Asset'),
  account('112', 'Deposits to Suppliers and/or Contractors', 'OCA', 'Asset'),
  account('113', 'Prepaid Expenses', 'OCA', 'Asset'),
  account('114', 'Input Tax', 'OCA', 'Asset'),
  account('115', 'Creditable Withholding Tax', 'OCA', 'Asset'),
  account('201', 'Accounts Payable - Trade', 'CUL', 'Liability'),
  account('202', 'VAT Payable', 'CUL', 'Liability'),
  account('401', 'Sales Revenue', 'OR', 'Revenue'),
  account('402', 'Sales Discount', 'OR', 'Revenue'),
  account('550', 'Supplies Expense', 'OE', 'Expense'),
  account('551', 'Subscription Expense', 'OE', 'Expense'),
  account('552', 'Software Subscriptions Expense', 'OE', 'Expense'),
  account('553', 'Utilities Expense', 'OE', 'Expense'),
  account('554', 'Internet Expense', 'OE', 'Expense'),
  account('555', 'Purchase Discount', 'OE', 'Expense'),
  account('557', 'Delivery Fee Expense', 'OE', 'Expense'),
  account('559', 'Meals & Allowances', 'OE', 'Expense'),
]

export const accountTypes: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

const byCode = (a: { code: string }, b: { code: string }) => a.code.localeCompare(b.code, undefined, { numeric: true })

export const accountRepository = createRepository<Account>('/accounts', seedAccounts, {
  searchText: (item) => `${item.code} ${item.name} ${item.type}`,
  defaultSort: { by: 'code', direction: 'asc' },
  validate: (record, others) => {
    if (others.some((item) => item.code === record.code)) throw validationError('This account code already exists.', 'code')
    if (!categoryStore.items.value.some((item) => item.code === record.parentCode)) throw validationError('Choose a valid parent category.', 'parentCode')
  },
})

export const accountCategoryRepository = createRepository<AccountCategory>('/account-categories', seedCategories, {
  searchText: (item) => `${item.code} ${item.name}`,
  validate: (record, others) => {
    if (others.some((item) => item.code === record.code)) throw validationError('This category code already exists.', 'code')
  },
  beforeRemove: (record) => {
    if (categoryStore.items.value.some((item) => item.parentCode === record.code) || accountStore.items.value.some((item) => item.parentCode === record.code)) {
      throw conflictError('Move or remove child categories and accounts before deleting this category.')
    }
  },
})

export const accountStore = createCollectionStore(accountRepository)
export const categoryStore = createCollectionStore(accountCategoryRepository)

/** Cached chart of accounts, sorted by code. Load with `accountStore.ensureLoaded()` or `useCollections`. */
export const accounts = accountStore.items
export const categories = categoryStore.items

export function sortedAccounts(list: readonly Account[]): Account[] {
  return [...list].sort(byCode)
}

export function categoryName(code: string): string {
  return categories.value.find((item) => item.code === code)?.name ?? ''
}

export function findAccount(id: string): Account | undefined {
  return accounts.value.find((item) => item.id === id)
}

export function accountName(id: string): string {
  return findAccount(id)?.name ?? 'Unknown account'
}

/** Options for account dropdowns. Keeps the current value listed even when that account is inactive. */
export function accountOptions(current = '') {
  return sortedAccounts(accounts.value.filter((item) => item.active || item.id === current))
    .map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))
}
