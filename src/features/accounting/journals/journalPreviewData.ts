import type { JournalEntry, JournalKind } from './journalStore'

export type { GeneralJournalType } from './journalStore'
export type JournalPreviewKind = JournalKind
export type JournalPreviewEntry = JournalEntry

export interface JournalPreviewConfig {
  label: string
  numberLabel: string
  partyLabel?: string
  transferLabel?: string
}

export const journalPreviewConfigs: Record<JournalPreviewKind, JournalPreviewConfig> = {
  'cash-disbursement-journal': { label: 'Cash Disbursement Journal', numberLabel: 'CDJ #', partyLabel: 'Payee' },
  'cash-receipt-journal': { label: 'Cash Receipt Journal', numberLabel: 'CRJ #', partyLabel: 'Customer' },
  'sales-journal': { label: 'Sales Journal', numberLabel: 'SJ #', partyLabel: 'Customer' },
  'purchase-journal': { label: 'Purchase Journal', numberLabel: 'PJ #', partyLabel: 'Vendor' },
  'general-journal': { label: 'General Journal', numberLabel: 'GJ #' },
}
