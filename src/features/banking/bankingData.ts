import { toIsoDate } from '../../components/ui/dateUtils'
import { createCollectionStore } from '../../services/collectionStore'
import { conflictError, createMemoryBackend, createRepository, selectRepository, stateError, validationError, type Entity } from '../../services/repository'
import { findAccount } from '../accounting/setup/accountSetupData'

export interface BankAccountRecord extends Entity {
  name: string
  bank: string
  accountNumber: string
  /** Chart of accounts `id` used for this bank's cash lines. */
  ledgerAccountId: string
  remarks: string
  active: boolean
}

export type BankTransactionStatus = 'Draft' | 'Journalized'
/** Money in (deposit, collection) or money out (payment, withdrawal). Decides the journal type. */
export type BankTransactionDirection = 'Receipt' | 'Disbursement'

export interface BankTransactionRecord extends Entity {
  date: string
  bankAccountId: string
  direction: BankTransactionDirection
  purpose: string
  partyType: string
  party: string
  amountCents: number
  /** Changes only through the create-journal operation. */
  status: BankTransactionStatus
  /** Chart of accounts `id` on the other side of the entry. */
  ledgerAccountId: string
  reference: string
  description: string
  /** Set by the server when the transaction is journalized. */
  journalEntryId: string
}

export type BankTransactionFilters = {
  status?: BankTransactionStatus
  bankAccountId?: string
  from?: string
  to?: string
}

// Preview sample. With an API configured it is not used.
const seedBankAccounts: BankAccountRecord[] = [
  { id: 'bank-joyno-union', name: 'JOYNO INC', bank: 'Union Bank of the Philippines', accountNumber: '003040001411', ledgerAccountId: '101', remarks: '', active: true },
]

export const bankTransactionBackend = createMemoryBackend<BankTransactionRecord, BankTransactionFilters>('/bank-transactions', [], {
  searchText: (item) => [item.date, bankAccountName(item.bankAccountId), item.purpose, item.party, findAccount(item.ledgerAccountId)?.name ?? '', item.reference, item.description, item.status].join(' '),
  matches: (item, filters) => (!filters.status || item.status === filters.status) && (!filters.bankAccountId || item.bankAccountId === filters.bankAccountId)
    && (!filters.from || item.date >= filters.from) && (!filters.to || item.date <= filters.to),
  defaultSort: { by: 'date', direction: 'desc' },
  summarize: (items) => ({ amountCents: items.reduce((sum, item) => sum + item.amountCents, 0) }),
  validate: (record, _others, existing) => {
    if (existing?.status === 'Journalized') throw stateError('Journalized bank transactions cannot be changed.')
    if (record.status !== 'Draft') throw stateError('Bank transactions are journalized with Create journal, not by editing.')
    if (!bankAccountStore.items.value.some((account) => account.id === record.bankAccountId)) throw validationError('Choose a bank account.', 'bankAccountId')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) throw validationError('Choose a transaction date.', 'date')
    if (!record.purpose.trim()) throw validationError('Enter the purpose of the transaction.', 'purpose')
    if (!findAccount(record.ledgerAccountId)?.active) throw validationError('Choose the related ledger account.', 'ledgerAccountId')
    if (!Number.isSafeInteger(record.amountCents) || record.amountCents <= 0) throw validationError('Enter an amount greater than zero.', 'amountCents')
  },
  prepare: (record) => ({ ...record, journalEntryId: '' }),
  beforeRemove: (record) => {
    if (record.status === 'Journalized') throw stateError('Journalized bank transactions cannot be deleted.')
  },
})

export const bankTransactionRepository = selectRepository('/bank-transactions', bankTransactionBackend)

export const bankAccountRepository = createRepository<BankAccountRecord>('/bank-accounts', seedBankAccounts, {
  searchText: (item) => `${item.name} ${item.bank} ${item.accountNumber}`,
  matches: (item, filters) => !filters.active || item.active,
  defaultSort: { by: 'name', direction: 'asc' },
  validate: (record, others) => {
    if (!record.name.trim()) throw validationError('Enter a name for this bank account.', 'name')
    if (record.accountNumber && others.some((item) => item.accountNumber === record.accountNumber)) throw validationError('That account number is already in use.', 'accountNumber')
    if (!findAccount(record.ledgerAccountId)?.active) throw validationError('Choose the ledger account used for transactions.', 'ledgerAccountId')
  },
  beforeRemove: (record) => {
    if (bankTransactionBackend.all().some((item) => item.bankAccountId === record.id)) {
      throw conflictError('This bank account has transactions. Mark it inactive instead of deleting it.')
    }
  },
})

export const bankAccountStore = createCollectionStore(bankAccountRepository)
export const bankAccounts = bankAccountStore.items

export function emptyBankAccount(): BankAccountRecord {
  return { id: '', name: '', bank: '', accountNumber: '', ledgerAccountId: '', remarks: '', active: true }
}

export function emptyBankTransaction(): BankTransactionRecord {
  return {
    id: '', date: toIsoDate(new Date()), bankAccountId: '', direction: 'Disbursement', purpose: '', partyType: '', party: '',
    amountCents: 0, status: 'Draft', ledgerAccountId: '', reference: '', description: '', journalEntryId: '',
  }
}

export function bankAccountName(id: string): string {
  return bankAccounts.value.find((account) => account.id === id)?.name ?? 'Unknown account'
}
