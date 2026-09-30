import { ref } from 'vue'

export type PurchaseKind = 'purchase-invoices' | 'payrolls' | 'cash-voucher' | 'check-voucher' | 'petty-cash-voucher' | 'purchase-receipts'
export type PurchaseStatus = 'Posted' | 'Draft'

export interface PurchaseLine { id: string; description: string; quantity: number; unitPriceCents: number }
export interface PurchaseRecord {
  id: string
  kind: PurchaseKind
  number: string
  date: string
  vendor: string
  amountCents: number
  totalCents: number
  paidCents: number
  status: PurchaseStatus
  remarks: string
  paymentMethod: string
  paymentTerms: string
  checkNumber: string
  taxCents: number
  lines: PurchaseLine[]
  month: string
  year: string
  period: string
  payrollFrequency: string
  payGroup: string
  accrualJE: string
}

export interface PurchaseConfig {
  title: string
  numberLabel: string
  tabs: string[]
  sampleCount: number
}

export const purchaseConfigs: Record<PurchaseKind, PurchaseConfig> = {
  'purchase-invoices': { title: 'Invoices', numberLabel: 'Sales Invoice #', tabs: ['Search', 'Unjournalized', 'Unpaid'], sampleCount: 10 },
  payrolls: { title: 'Payrolls', numberLabel: 'Series No', tabs: ['Search', 'Unjournalized'], sampleCount: 0 },
  'cash-voucher': { title: 'Cash Vouchers', numberLabel: 'Cash Voucher #', tabs: ['Search', 'Unreconciled', 'Unjournalized'], sampleCount: 10 },
  'check-voucher': { title: 'Check Vouchers', numberLabel: 'Check Voucher #', tabs: ['Search', 'Unreconciled', 'Unjournalized'], sampleCount: 0 },
  'petty-cash-voucher': { title: 'Petty Cash Vouchers', numberLabel: 'Petty Cash Voucher #', tabs: ['Search', 'Unreconciled', 'Unjournalized'], sampleCount: 0 },
  'purchase-receipts': { title: 'Receipts', numberLabel: 'Receipt #', tabs: ['Search', 'Unjournalized'], sampleCount: 2 },
}

function sample(kind: PurchaseKind, number: string, date: string, vendor: string, amountCents: number, totalCents: number, paidCents: number, remarks = '', paymentMethod = ''): PurchaseRecord {
  return { id: `${kind}-${number}`, kind, number, date, vendor, amountCents, totalCents, paidCents, status: 'Posted', remarks, paymentMethod, paymentTerms: '', checkNumber: '', taxCents: totalCents - amountCents, lines: [], month: '', year: '', period: '', payrollFrequency: '', payGroup: '', accrualJE: '' }
}

// Only rows whose values are visible in the supplied screenshots. No missing records or totals are fabricated.
export const purchaseRecords = ref<PurchaseRecord[]>([
  sample('purchase-invoices', 'INV-CEBU-0550', '2026-09-01', 'RADIUS TELECOMS, INC.', 4100000, 4592000, 0, 'Internet Billing for Sept 2026'),
  sample('purchase-invoices', '060748', '2026-09-01', 'GSC Gas Station', 4464, 5000, 5000, 'Fuel Expense'),
  sample('purchase-invoices', '195392', '2026-09-01', 'Park Secure Management Corporation', 2679, 3000, 3000, 'Parking'),
  sample('purchase-invoices', '01210452', '2026-09-04', 'Ensaimada Latik Inc.', 123036, 137800, 137800, 'Cake for employee birthday'),
  sample('purchase-invoices', '669977', '2026-09-04', "Robinson's Supermarket Corporation", 30357, 34000, 34000),
  sample('purchase-invoices', '229377', '2026-09-04', 'Mega GoldTown Pan Inc.', 16964, 19000, 19000),
  sample('purchase-invoices', '3354', '2026-09-05', 'RJ Siton', 1050000, 1050000, 1050000, 'Whole Lechon for Company'),
  sample('purchase-invoices', '229756', '2026-09-05', 'Mega GoldTown Pan Inc.', 39911, 44700, 44700, 'Snacks for employees'),
  sample('purchase-invoices', 'FBADS-232-106503701', '2026-09-06', 'Meta Platforms Ireland Limited', 100500, 112560, 112560, 'FB Ads'),
  sample('purchase-invoices', '2052', '2026-09-07', 'Mario S. Rizon Jr.', 46000, 46000, 46000, 'A4 Bondpaper'),
  ...Array.from({ length: 10 }, (_, index) => sample('cash-voucher', String(index + 13).padStart(5, '0'), '2026-09-16', 'City of Lapu-Lapu', 15500, 15500, 0, [14, 15, 22].includes(index + 13) ? 'Employee Lab Tests' : '')),
  sample('purchase-receipts', '2720-0329-8890', '2026-09-09', 'Anthropic, PBC', 138880, 138880, 138880, '', 'Bank Transfer'),
  sample('purchase-receipts', '2742-2556-2845', '2026-09-12', 'OpenAI OpCo, LLC', 110000, 110000, 110000, '', 'Bank Transfer'),
])
