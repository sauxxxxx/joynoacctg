import { isPreviewMode } from '../../../services/api/config'
import { journalBackend, type JournalEntry, type JournalLine } from './journalStore'

export { journalLineTotals } from './journalStore'
export type PurchaseJournalLine = JournalLine
export type PurchaseJournalEntry = JournalEntry
export const samplePurchaseJournalEntries: PurchaseJournalEntry[] = journalBackend.all().filter((entry) => entry.kind === 'purchase-journal')

/** Default date range for journal pages: the current month, or the month the preview samples are dated. */
export function sampleJournalRange() {
  if (isPreviewMode) return { from: '2026-09-01', to: '2026-09-30' }
  const today = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const iso = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  return { from: iso(new Date(today.getFullYear(), today.getMonth(), 1)), to: iso(new Date(today.getFullYear(), today.getMonth() + 1, 0)) }
}

export function formatJournalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

export function formatJournalAmount(amountCents: number): string {
  return new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amountCents / 100)
}
