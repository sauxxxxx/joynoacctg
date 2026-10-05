import type { CreateJournalsResponseDto, EntityResponseDto } from '../../../contracts/dto'
import { dataMode } from '../../../services/api/config'
import { ApiError } from '../../../services/api/errors'
import { http } from '../../../services/api/httpClient'
import { stateError, validationError } from '../../../services/repository'
import { currentActorName } from '../../auth/authStore'
import { bankAccountRepository, bankTransactionBackend, type BankTransactionRecord } from '../../banking/bankingData'
import { recordAudit } from '../../company/auditLog'
import { journalBackend, journalLinesError, journalLineTotals, nextJournalNumber, type JournalEntry, type JournalKind, type JournalLine } from './journalStore'

export interface CreateJournalsResult {
  created: number
  /** Sources that were already journalized; the operation is idempotent per source. */
  existing: number
}

/**
 * Accounting operations that only the server may perform: posting, voiding, and generating posted
 * journals from source documents. Each call is atomic: every selected record succeeds or none change.
 */
export interface JournalOperations {
  post(entry: JournalEntry): Promise<JournalEntry>
  void(entry: JournalEntry): Promise<JournalEntry>
  /** Cash receipt or disbursement journals for draft bank transactions, by their direction. */
  createFromBankTransactions(ids: string[]): Promise<CreateJournalsResult>
  /** Cash disbursement journals that pay the selected Purchase Journal entries. */
  createPaymentsFromPurchaseJournal(ids: string[]): Promise<CreateJournalsResult>
}

const httpOperations: JournalOperations = {
  async post(entry) {
    return (await http.post<EntityResponseDto<JournalEntry>>(`/journal-entries/${encodeURIComponent(entry.id)}/post`, { expectedVersion: entry.version })).data
  },
  async void(entry) {
    return (await http.post<EntityResponseDto<JournalEntry>>(`/journal-entries/${encodeURIComponent(entry.id)}/void`, { expectedVersion: entry.version })).data
  },
  async createFromBankTransactions(ids) {
    const { created, existing } = (await http.post<EntityResponseDto<CreateJournalsResponseDto>>('/bank-transactions/create-journals', { sourceIds: ids })).data
    return { created, existing }
  },
  async createPaymentsFromPurchaseJournal(ids) {
    const { created, existing } = (await http.post<EntityResponseDto<CreateJournalsResponseDto>>('/journal-entries/create-cash-disbursements', { sourceIds: ids })).data
    return { created, existing }
  },
}

// ------------------------------------------------------------------ Preview server

interface JournalDraft {
  kind: JournalKind
  sourceKey: string
  referenceNumber: string
  date: string
  party: string
  remarks: string
  lines: JournalLine[]
}

function uniqueIds(ids: string[]) {
  if (!ids.length) throw validationError('Select at least one record.')
  if (new Set(ids).size !== ids.length) throw validationError('The selection contains a duplicate source record.')
}

/** Validates every draft, then writes them all, so a failure leaves nothing half-done. */
function writePostedJournals(drafts: JournalDraft[]): Map<string, JournalEntry> {
  for (const draft of drafts) {
    const error = journalLinesError(draft.lines)
    if (error) throw validationError(`${draft.referenceNumber || draft.sourceKey}: ${error}`)
  }
  const written = new Map<string, JournalEntry>()
  for (const draft of drafts) {
    const entry = journalBackend.write({
      id: '', ...draft, journalNumber: nextJournalNumber(journalBackend.all(), draft.kind),
      amountCents: journalLineTotals(draft.lines).debitCents, status: 'Posted', createdBy: currentActorName(),
    })
    recordAudit('Accounting', 'Posted', `${draft.kind} ${entry.journalNumber}`, `Created from ${draft.sourceKey}.`)
    written.set(draft.sourceKey, entry)
  }
  return written
}

function existingFor(sourceKey: string) {
  return journalBackend.all().find((entry) => entry.sourceKey === sourceKey)
}

function bankJournalDraft(item: BankTransactionRecord, cashAccountId: string): JournalDraft {
  const receipt = item.direction === 'Receipt'
  return {
    kind: receipt ? 'cash-receipt-journal' : 'cash-disbursement-journal',
    sourceKey: `bank-transaction:${item.id}`, referenceNumber: item.reference, date: item.date, party: item.party,
    remarks: item.description || item.purpose,
    lines: receipt
      ? [{ accountId: cashAccountId, debitCents: item.amountCents, creditCents: 0 }, { accountId: item.ledgerAccountId, debitCents: 0, creditCents: item.amountCents }]
      : [{ accountId: item.ledgerAccountId, debitCents: item.amountCents, creditCents: 0 }, { accountId: cashAccountId, debitCents: 0, creditCents: item.amountCents }],
  }
}

function transition(entry: JournalEntry, from: JournalEntry['status'], to: JournalEntry['status'], message: string): JournalEntry {
  const current = journalBackend.all().find((item) => item.id === entry.id)
  if (!current) throw new ApiError('NOT_FOUND', undefined, { status: 404 })
  if (entry.version !== undefined && current.version !== entry.version) throw new ApiError('CONFLICT', undefined, { status: 409 })
  if (current.status !== from) throw stateError(message)
  if (to === 'Posted') {
    const error = journalLinesError(current.lines)
    if (error) throw validationError(error, 'lines')
  }
  const saved = journalBackend.write({ ...current, status: to })
  recordAudit('Accounting', to === 'Posted' ? 'Posted' : 'Voided', `${current.kind} ${current.journalNumber || current.referenceNumber}`, to === 'Voided' ? 'Original lines preserved.' : '')
  return saved
}

const previewOperations: JournalOperations = {
  async post(entry) { return transition(entry, 'Draft', 'Posted', 'Only draft journal entries can be posted.') },
  async void(entry) { return transition(entry, 'Posted', 'Voided', 'Only posted journal entries can be voided.') },

  async createFromBankTransactions(ids) {
    uniqueIds(ids)
    const transactions = bankTransactionBackend.all()
    const accounts = await bankAccountRepository.listAll()
    const pending: { item: BankTransactionRecord; draft: JournalDraft }[] = []
    let existing = 0
    for (const id of ids) {
      const item = transactions.find((transaction) => transaction.id === id)
      if (!item) throw new ApiError('NOT_FOUND', 'One of the selected transactions no longer exists. Reload and try again.', { status: 404 })
      if (item.status === 'Journalized') { existing += 1; continue }
      const cashAccountId = accounts.find((account) => account.id === item.bankAccountId)?.ledgerAccountId
      if (!cashAccountId) throw validationError(`Complete the bank account for ${item.reference || item.purpose}.`)
      pending.push({ item, draft: bankJournalDraft(item, cashAccountId) })
    }
    const written = writePostedJournals(pending.map(({ draft }) => draft))
    for (const { item, draft } of pending) {
      bankTransactionBackend.write({ ...item, status: 'Journalized', journalEntryId: written.get(draft.sourceKey)!.id })
    }
    return { created: pending.length, existing }
  },

  async createPaymentsFromPurchaseJournal(ids) {
    uniqueIds(ids)
    const entries = journalBackend.all()
    const drafts: JournalDraft[] = []
    let existing = 0
    for (const id of ids) {
      const entry = entries.find((item) => item.id === id && item.kind === 'purchase-journal')
      if (!entry) throw new ApiError('NOT_FOUND', 'One of the selected entries no longer exists. Reload and try again.', { status: 404 })
      if (entry.status !== 'Posted') throw stateError(`${entry.referenceNumber} is not posted.`)
      const sourceKey = `purchase-payment:${entry.id}`
      if (existingFor(sourceKey)) { existing += 1; continue }
      drafts.push({
        kind: 'cash-disbursement-journal', sourceKey, referenceNumber: entry.referenceNumber, date: entry.date, party: entry.party,
        remarks: `Payment for ${entry.remarks || entry.referenceNumber}`,
        lines: [{ accountId: '201', debitCents: entry.amountCents, creditCents: 0 }, { accountId: '101', debitCents: 0, creditCents: entry.amountCents }],
      })
    }
    writePostedJournals(drafts)
    return { created: drafts.length, existing }
  },
}

export const journalOperations: JournalOperations = dataMode === 'api' ? httpOperations : previewOperations

export function describeJournalResult(result: CreateJournalsResult, noun = 'journal entry'): string {
  const plural = noun.endsWith('y') ? `${noun.slice(0, -1)}ies` : `${noun}s`
  if (!result.created) return result.existing ? 'The selected records were already journalized.' : 'Nothing was journalized.'
  const already = result.existing ? ` ${result.existing} ${result.existing === 1 ? 'was' : 'were'} already journalized.` : ''
  return `${result.created} ${result.created === 1 ? noun : plural} created and posted.${already}`
}
