import type { PageResult, TableQuery } from '../../../lib/tableQuery'
import type { JournalSource } from '../../accounting/reports/ledgerContract'

export type BirBookSort = 'date' | 'entryNumber' | 'source' | 'debitCents' | 'creditCents'

export interface BirBookFilters extends Record<string, unknown> {
  from: string
  to: string
  source: JournalSource | ''
}

export interface BirBookEntry {
  id: string
  bookType: string
  entryNumber: string
  date: string
  source: JournalSource
  sourceLabel: string
  reference: string
  description: string
  debitCents: number
  creditCents: number
}

export type BirBooksQuery = TableQuery<BirBookSort, BirBookFilters>

export interface BirBooksService {
  list(query: BirBooksQuery): Promise<PageResult<BirBookEntry>>
}
