import type { PurchaseJournalLine } from './purchaseJournalData'

export type JournalPreviewKind = 'cash-disbursement-journal' | 'cash-receipt-journal' | 'sales-journal' | 'general-journal'

export interface JournalPreviewEntry {
  id: string
  journalNumber: string
  referenceNumber: string
  date: string
  party: string
  amountCents: number
  status: 'Posted' | 'Draft'
  remarks: string
  createdBy: string
  lines: PurchaseJournalLine[]
}

export interface JournalPreviewConfig {
  label: string
  numberLabel: string
  partyLabel?: string
  transferLabel?: string
  entries: JournalPreviewEntry[]
}

// Only records visible in the supplied reference are represented here. These are UI samples,
// not real posted transactions or a reconstruction of the screenshot's full 62-row dataset.
const cashDisbursementSamples: JournalPreviewEntry[] = [
  {
    id: 'cdj-sample-1', journalNumber: '', referenceNumber: '0000675524', date: '2026-09-18',
    party: "Robinson's Supermarket Corporation", amountCents: 25100, status: 'Posted', remarks: '', createdBy: 'System',
    lines: [
      { accountName: 'Supplies Expense', debitCents: 22411, creditCents: 0 },
      { accountName: 'Input Tax', debitCents: 2689, creditCents: 0 },
      { accountName: 'Cash', debitCents: 0, creditCents: 25100 },
    ],
  },
  {
    id: 'cdj-sample-2', journalNumber: '', referenceNumber: '0000675490', date: '2026-09-18',
    party: "Robinson's Supermarket Corporation", amountCents: 79025, status: 'Posted',
    remarks: 'Ice cream for employee birthday', createdBy: 'System', lines: [],
  },
]

export const journalPreviewConfigs: Record<JournalPreviewKind, JournalPreviewConfig> = {
  'cash-disbursement-journal': {
    label: 'Cash Disbursement Journal', numberLabel: 'CDJ #', partyLabel: 'Payee',
    transferLabel: 'Move to Purchase Journal', entries: cashDisbursementSamples,
  },
  'cash-receipt-journal': {
    label: 'Cash Receipt Journal', numberLabel: 'CRJ #', partyLabel: 'Customer',
    transferLabel: 'Move to Sales Journal', entries: [],
  },
  'sales-journal': {
    label: 'Sales Journal', numberLabel: 'SJ #', partyLabel: 'Customer',
    transferLabel: 'Move to CRJ', entries: [],
  },
  'general-journal': {
    label: 'General Journal', numberLabel: 'GJ #', entries: [],
  },
}
