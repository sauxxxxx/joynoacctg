import { compareValues, paginate } from '../../../lib/tableQuery'
import { journalSourceLabels } from '../../accounting/reports/ledgerContract'
import { createSampleLedgerSource } from '../../accounting/reports/sampleLedger'
import type { BirBookEntry, BirBooksQuery, BirBooksService } from './birBooksContract'

const wait = (milliseconds: number) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))
const pad = (value: number) => String(value).padStart(2, '0')
const today = () => { const value = new Date(); return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}` }

export const previewBirBooksService: BirBooksService = {
  async list(query: BirBooksQuery) {
    await wait(120)
    const source = createSampleLedgerSource(today())
    const entries = await source.loadEntries()
    const term = query.search.trim().toLocaleLowerCase()
    const rows: BirBookEntry[] = entries.filter((entry) => entry.status === 'posted').map((entry) => ({
      id: entry.id,
      bookType: journalSourceLabels[entry.source],
      entryNumber: entry.entryNumber,
      date: entry.date,
      source: entry.source,
      sourceLabel: journalSourceLabels[entry.source],
      reference: entry.reference,
      description: entry.description,
      debitCents: entry.lines.reduce((sum, line) => sum + line.debitCents, 0),
      creditCents: entry.lines.reduce((sum, line) => sum + line.creditCents, 0),
    })).filter((entry) => (!query.filters.from || entry.date >= query.filters.from)
      && (!query.filters.to || entry.date <= query.filters.to)
      && (!query.filters.source || entry.source === query.filters.source)
      && (!term || `${entry.bookType} ${entry.entryNumber} ${entry.reference} ${entry.description}`.toLocaleLowerCase().includes(term)))
    rows.sort((left, right) => compareValues(left[query.sortBy], right[query.sortBy], query.sortDirection))
    return paginate(rows, query.page, query.pageSize)
  },
}
