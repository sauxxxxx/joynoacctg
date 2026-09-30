import { ref } from 'vue'

export interface BankAccountRecord {
  id: string
  name: string
  bank: string
  accountNumber: string
  ledgerAccount: string
  remarks: string
  active: boolean
}

export type BankTransactionStatus = 'Draft' | 'Journalized'

export interface BankTransactionRecord {
  id: string
  date: string
  bankAccountId: string
  purpose: string
  partyType: string
  party: string
  amountCents: number
  status: BankTransactionStatus
  ledgerAccount: string
  reference: string
  description: string
}

export const bankAccounts = ref<BankAccountRecord[]>([
  {
    id: 'bank-joyno-union',
    name: 'JOYNO INC',
    bank: 'Union Bank of the Philippines',
    accountNumber: '003040001411',
    ledgerAccount: 'Cash',
    remarks: '',
    active: true,
  },
])

export const bankTransactions = ref<BankTransactionRecord[]>([])

export function emptyBankAccount(): BankAccountRecord {
  return { id: '', name: '', bank: '', accountNumber: '', ledgerAccount: 'Cash', remarks: '', active: true }
}

export function emptyBankTransaction(): BankTransactionRecord {
  return {
    id: '', date: '2026-09-30', bankAccountId: '', purpose: '', partyType: '', party: '', amountCents: 0,
    status: 'Draft', ledgerAccount: '', reference: '', description: '',
  }
}

export function bankAccountName(id: string): string {
  return bankAccounts.value.find((account) => account.id === id)?.name ?? 'Unknown account'
}
