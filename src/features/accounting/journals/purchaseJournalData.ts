export interface PurchaseJournalEntry {
  id: string
  journalNumber: string
  referenceNumber: string
  date: string
  payee: string
  amountCents: number
}

function localDate(daysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function currentMonthRange() {
  const today = localDate(0)
  return { from: `${today.slice(0, 7)}-01`, to: today }
}

// Sample entries make the frontend usable until journal data is connected.
const referenceYear = new Date().getFullYear()
export const samplePurchaseJournalEntries: PurchaseJournalEntry[] = [
  { id: 'pj-001', journalNumber: 'PJ-001', referenceNumber: `INV-${referenceYear}-1042`, date: localDate(1), payee: 'Harborline Office Supply', amountCents: 1850000 },
  { id: 'pj-002', journalNumber: 'PJ-002', referenceNumber: `INV-${referenceYear}-1038`, date: localDate(3), payee: 'Northpoint Trading', amountCents: 4275000 },
  { id: 'pj-003', journalNumber: 'PJ-003', referenceNumber: `OR-${referenceYear}-0841`, date: localDate(5), payee: 'Cebu Equipment Services', amountCents: 985000 },
  { id: 'pj-004', journalNumber: 'PJ-004', referenceNumber: `INV-${referenceYear}-1027`, date: localDate(7), payee: 'Metro Paper & Print', amountCents: 1260000 },
  { id: 'pj-005', journalNumber: 'PJ-005', referenceNumber: `INV-${referenceYear}-1021`, date: localDate(9), payee: 'Pacific Maintenance Co.', amountCents: 3125000 },
  { id: 'pj-006', journalNumber: 'PJ-006', referenceNumber: `OR-${referenceYear}-0829`, date: localDate(11), payee: 'Central Hardware Depot', amountCents: 746500 },
  { id: 'pj-007', journalNumber: 'PJ-007', referenceNumber: `INV-${referenceYear}-1009`, date: localDate(14), payee: 'Lapu-Lapu Business Forms', amountCents: 560000 },
  { id: 'pj-008', journalNumber: 'PJ-008', referenceNumber: `INV-${referenceYear}-0994`, date: localDate(18), payee: 'Southport Logistics', amountCents: 2340000 },
]

export function formatJournalDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
    .format(new Date(year, month - 1, day))
}

export function formatPesos(amountCents: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amountCents / 100)
}
