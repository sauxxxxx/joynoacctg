import { createMemoryBackend, selectRepository, stateError, validationError, type Entity } from '../../../services/repository'
import { findAccount } from '../setup/accountSetupData'

export type JournalKind = 'purchase-journal' | 'cash-disbursement-journal' | 'cash-receipt-journal' | 'sales-journal' | 'general-journal'
export type JournalStatus = 'Draft' | 'Posted' | 'Voided'
export type GeneralJournalType = 'Adjusting Entry' | 'Reversing Entry' | 'Beginning Balance' | 'Closing Entry'

export interface JournalLine {
  /** Account `id` from the chart of accounts. */
  accountId: string
  subsidiary?: string
  debitCents: number
  creditCents: number
  remarks?: string
}

export interface JournalEntry extends Entity {
  kind: JournalKind
  /** Assigned by the server when the entry is created. */
  journalNumber: string
  referenceNumber: string
  date: string
  party: string
  /** Server-calculated debit total. */
  amountCents: number
  /** Changes only through the post and void operations. */
  status: JournalStatus
  remarks: string
  createdBy: string
  lines: JournalLine[]
  journalType?: GeneralJournalType
  /** Set when the entry was generated from a source record, e.g. `bank-transaction:{id}`. */
  sourceKey?: string
}

export type JournalFilters = {
  kind?: JournalKind
  status?: JournalStatus
  from?: string
  to?: string
}

export function journalLineTotals(lines: readonly JournalLine[]) {
  return lines.reduce((totals, line) => ({
    debitCents: totals.debitCents + line.debitCents,
    creditCents: totals.creditCents + line.creditCents,
  }), { debitCents: 0, creditCents: 0 })
}

/** Line rules shared by the preview server and the editor. Returns an error message or ''. */
export function journalLinesError(lines: readonly JournalLine[]): string {
  if (lines.length < 2) return 'A journal entry requires at least two accounting lines.'
  for (const [index, line] of lines.entries()) {
    if (!Number.isSafeInteger(line.debitCents) || !Number.isSafeInteger(line.creditCents) || line.debitCents < 0 || line.creditCents < 0) return `Enter a valid amount on line ${index + 1}.`
    if ((line.debitCents > 0) === (line.creditCents > 0)) return `Enter either a debit or a credit on line ${index + 1}.`
  }
  const totals = journalLineTotals(lines)
  if (totals.debitCents <= 0 || totals.debitCents !== totals.creditCents) return 'Debits and credits must be positive and balanced.'
  return ''
}

const sampleLine = (accountId: string, debitCents: number, creditCents: number, remarks?: string): JournalLine => ({ accountId, debitCents, creditCents, remarks })
const purchaseLines = (expenseAccountId: string, amountCents: number) => [sampleLine(expenseAccountId, amountCents, 0), sampleLine('201', 0, amountCents)]
const sample = (kind: JournalKind, id: string, referenceNumber: string, date: string, party: string, amountCents: number, remarks: string, lines: JournalLine[]): JournalEntry =>
  ({ id, kind, journalNumber: '', referenceNumber, date, party, amountCents, status: 'Posted', remarks, createdBy: 'System', lines })

// Preview samples copied from the reference screens. With an API configured these are not used.
const seedJournals: JournalEntry[] = [
  sample('cash-disbursement-journal', 'cdj-sample-1', '0000675524', '2026-09-18', "Robinson's Supermarket Corporation", 25100, '', [sampleLine('550', 22411, 0), sampleLine('114', 2689, 0), sampleLine('101', 0, 25100)]),
  sample('cash-disbursement-journal', 'cdj-sample-2', '0000675490', '2026-09-18', "Robinson's Supermarket Corporation", 79025, 'Ice cream for employee birthday', []),
  sample('purchase-journal', 'pj-sample-1', 'HY8REIRA-0005', '2026-09-12', 'OpenAI OpCo, LLC', 110000, 'ChatGPT Plus Subscription', [
    sampleLine('551', 98214, 0), sampleLine('114', 11786, 0, 'ChatGPT Plus Subscription'), sampleLine('201', 0, 110000, 'ChatGPT Plus Subscription'),
  ]),
  sample('purchase-journal', 'pj-sample-2', 'VUXK2MLL-0001', '2026-09-09', 'Anthropic, PBC', 138880, 'Invoice for Claude AI Subscription', purchaseLines('552', 138880)),
  sample('purchase-journal', 'pj-sample-3', '000214', '2026-09-08', 'Tower One Plaza Magellan Building Administration Inc.', 5744605, 'Electricity', purchaseLines('553', 5744605)),
  sample('purchase-journal', 'pj-sample-4', 'INV-CEBU-0550', '2026-09-01', 'RADIUS TELECOMS, INC.', 4592000, 'Internet Billing for Sept 2026', purchaseLines('554', 4592000)),
]

/** Next sequential number for a journal kind, as the server assigns it. */
export function nextJournalNumber(entries: readonly JournalEntry[], kind: JournalKind): string {
  const numbers = entries.filter((entry) => entry.kind === kind).map((entry) => Number(entry.journalNumber)).filter(Number.isFinite)
  return String(Math.max(0, ...numbers) + 1)
}

/** Preview server for `/journal-entries`. Clients may only create and edit General Journal drafts. */
export const journalBackend = createMemoryBackend<JournalEntry, JournalFilters>('/journal-entries', seedJournals, {
  searchText: (entry) => [entry.journalNumber, entry.referenceNumber, entry.party, entry.status, entry.remarks, entry.createdBy].join(' '),
  matches: (entry, filters) => (!filters.kind || entry.kind === filters.kind) && (!filters.status || entry.status === filters.status)
    && (!filters.from || entry.date >= filters.from) && (!filters.to || entry.date <= filters.to),
  defaultSort: { by: 'date', direction: 'desc' },
  summarize: (entries) => ({ amountCents: entries.reduce((sum, entry) => sum + entry.amountCents, 0) }),
  validate: (record, _others, existing) => {
    if (record.kind !== 'general-journal') throw validationError('Only General Journal entries can be entered directly.', 'kind')
    if (existing && existing.status !== 'Draft') throw stateError('Posted and voided journal entries cannot be changed.')
    if (record.status !== 'Draft') throw stateError('Save the entry as a draft, then post it.')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.date)) throw validationError('Choose a valid date.', 'date')
    const linesError = journalLinesError(record.lines)
    if (linesError) throw validationError(linesError, 'lines')
    const inactive = record.lines.findIndex((line) => !findAccount(line.accountId)?.active)
    if (inactive >= 0) throw validationError(`Choose an active Chart of Accounts entry on line ${inactive + 1}.`, `lines.${inactive}.accountId`)
  },
  prepare: (record, others, existing) => ({
    ...record,
    journalNumber: existing?.journalNumber || nextJournalNumber(others, record.kind),
    amountCents: journalLineTotals(record.lines).debitCents,
    createdBy: existing?.createdBy || record.createdBy,
  }),
  beforeRemove: (entry) => {
    if (entry.status !== 'Draft') throw stateError('Posted journal entries cannot be deleted. Void the entry instead.')
  },
})

export const journalRepository = selectRepository('/journal-entries', journalBackend)
