export interface PurchaseJournalEntry {
  id: string
  journalNumber: string
  referenceNumber: string
  date: string
  payee: string
  amountCents: number
  status: 'Posted'
  remarks: string
  createdBy: string
}

export function sampleJournalRange() {
  return { from: '2026-09-01', to: '2026-09-30' }
}

// Reference-aligned sample entries; no journal data is saved or posted here.
export const samplePurchaseJournalEntries: PurchaseJournalEntry[] = [
  { id: 'pj-sample-1', journalNumber: '', referenceNumber: 'HY8REIRA-0005', date: '2026-09-12', payee: 'OpenAI OpCo, LLC', amountCents: 110000, status: 'Posted', remarks: 'ChatGPT Plus Subscription', createdBy: 'System' },
  { id: 'pj-sample-2', journalNumber: '', referenceNumber: 'VUXK2MLL-0001', date: '2026-09-09', payee: 'Anthropic, PBC', amountCents: 138880, status: 'Posted', remarks: 'Invoice for Claude AI Subscription', createdBy: 'System' },
  { id: 'pj-sample-3', journalNumber: '', referenceNumber: '000214', date: '2026-09-08', payee: 'Tower One Plaza Magellan Building Administration Inc.', amountCents: 5744605, status: 'Posted', remarks: 'Electricity', createdBy: 'System' },
  { id: 'pj-sample-4', journalNumber: '', referenceNumber: 'INV-CEBU-0550', date: '2026-09-01', payee: 'RADIUS TELECOMS, INC.', amountCents: 4592000, status: 'Posted', remarks: 'Internet Billing for Sept 2026', createdBy: 'System' },
]

export function formatJournalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

export function formatJournalAmount(amountCents: number): string {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountCents / 100)
}
