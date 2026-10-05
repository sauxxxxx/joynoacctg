import type { JournalEntry, JournalKind } from './journalStore'

export type { GeneralJournalType } from './journalStore'
export type JournalPreviewKind = Exclude<JournalKind, 'purchase-journal'>
export type JournalPreviewEntry = JournalEntry

export interface JournalPreviewConfig {
  label: string
  numberLabel: string
  partyLabel?: string
  transferLabel?: string
}

export const journalPreviewConfigs: Record<JournalPreviewKind, JournalPreviewConfig> = {
  'cash-disbursement-journal': { label: 'Cash Disbursement Journal', numberLabel: 'CDJ #', partyLabel: 'Payee', transferLabel: 'Move to Purchase Journal' },
  'cash-receipt-journal': { label: 'Cash Receipt Journal', numberLabel: 'CRJ #', partyLabel: 'Customer', transferLabel: 'Move to Sales Journal' },
  'sales-journal': { label: 'Sales Journal', numberLabel: 'SJ #', partyLabel: 'Customer', transferLabel: 'Move to CRJ' },
  'general-journal': { label: 'General Journal', numberLabel: 'GJ #' },
}
