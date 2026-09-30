import { ref } from 'vue'

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense'

export interface AccountCategory {
  code: string
  name: string
  parentCode: string
  remarks: string
  active: boolean
  accountType?: AccountType
}

export interface Account {
  code: string
  name: string
  parentCode: string
  type: AccountType
  remarks: string
  active: boolean
  itr: string
  legalBasis: string
}

// Reference samples are kept in memory. They are not connected to the accounting database.
export const categories = ref<AccountCategory[]>([
  { code: 'CUA', name: 'Current Assets', parentCode: '', remarks: '', active: true },
  { code: 'CCE', name: 'Cash and Cash Equivalents', parentCode: 'CUA', remarks: '', active: true },
  { code: 'CR', name: 'Current Receivables', parentCode: 'CUA', remarks: '', active: true },
  { code: 'I', name: 'Inventories', parentCode: 'CUA', remarks: '', active: true },
  { code: 'OCA', name: 'Other Current Assets', parentCode: 'CUA', remarks: '', active: true },
  { code: 'NCA', name: 'Non-current Assets', parentCode: '', remarks: '', active: true },
  { code: 'IA', name: 'Intangible Assets', parentCode: 'NCA', remarks: '', active: true },
  { code: 'LTI', name: 'Long Term Investments', parentCode: 'NCA', remarks: '', active: true },
  { code: 'CUL', name: 'Current Liabilities', parentCode: '', remarks: '', active: true },
  { code: 'NCL', name: 'Non-current Liabilities', parentCode: '', remarks: '', active: true },
  { code: 'CAP', name: 'Capital', parentCode: '', remarks: '', active: true },
  { code: 'RE', name: 'Retained Earnings', parentCode: '', remarks: '', active: true },
  { code: 'NOR', name: 'Non-operating Revenues', parentCode: '', remarks: '', active: true },
  { code: 'OR', name: 'Operating Revenues', parentCode: '', remarks: '', active: true },
  { code: 'COS', name: 'Cost of Sales', parentCode: '', remarks: '', active: true },
  { code: 'FE', name: 'Financial Expenses', parentCode: '', remarks: '', active: true },
  { code: 'IT', name: 'Income Taxes', parentCode: '', remarks: '', active: true },
  { code: 'OE', name: 'Other Expenses', parentCode: '', remarks: '', active: true },
])

export const accounts = ref<Account[]>([
  { code: '101', name: 'Cash', parentCode: 'CCE', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '102', name: 'Petty Cash Fund', parentCode: 'CCE', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '103', name: 'Accounts Receivable - Trade', parentCode: 'CR', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '104', name: 'Accounts Receivable - Others', parentCode: 'CR', type: 'Asset', remarks: '', active: false, itr: '', legalBasis: '' },
  { code: '105', name: 'Merchandise Inventory', parentCode: 'I', type: 'Asset', remarks: '', active: false, itr: '', legalBasis: '' },
  { code: '109', name: 'Advances to Employees', parentCode: 'OCA', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '110', name: 'Advances to Officers and Stockholders', parentCode: 'OCA', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '111', name: 'Advances to Suppliers and/or Contractors', parentCode: 'OCA', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '112', name: 'Deposits to Suppliers and/or Contractors', parentCode: 'OCA', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '113', name: 'Prepaid Expenses', parentCode: 'OCA', type: 'Asset', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '557', name: 'Delivery Fee Expense', parentCode: 'OE', type: 'Expense', remarks: '', active: true, itr: '', legalBasis: '' },
  { code: '559', name: 'Meals & Allowances', parentCode: 'OE', type: 'Expense', remarks: '', active: true, itr: '', legalBasis: '' },
])

export const accountTypes: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']

export function categoryName(code: string): string {
  return categories.value.find((category) => category.code === code)?.name ?? ''
}
