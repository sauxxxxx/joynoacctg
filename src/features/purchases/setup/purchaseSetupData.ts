import { ref } from 'vue'

export type PurchaseSetupKind = 'vendors' | 'revolving-fund-customers' | 'purchases-discount-types' | 'purchases-payment-terms' | 'purchases-payment-methods'

export interface PurchaseSetupRecord {
  id: string
  kind: PurchaseSetupKind
  name: string
  tin: string
  address: string
  account: string
  active: boolean
  computation: string
  rate: number
  allowOverride: boolean
  payments: number
  frequency: string
  dueOn: number
  paymentDue: string
}

export const purchaseSetupTitles: Record<PurchaseSetupKind, string> = {
  vendors: 'Vendors',
  'revolving-fund-customers': 'Revolving Fund Custodians',
  'purchases-discount-types': 'Discount Types',
  'purchases-payment-terms': 'Payment Terms',
  'purchases-payment-methods': 'Payment Methods',
}

function record(kind: PurchaseSetupKind, name: string, values: Partial<PurchaseSetupRecord> = {}): PurchaseSetupRecord {
  return {
    id: `${kind}-${name.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    kind,
    name,
    tin: '',
    address: '',
    account: '',
    active: true,
    computation: 'Amount',
    rate: 0,
    allowOverride: false,
    payments: 1,
    frequency: '',
    dueOn: 0,
    paymentDue: 'Days',
    ...values,
  }
}

// Only values visible in the supplied reference screens are seeded here.
export const purchaseSetupRecords = ref<PurchaseSetupRecord[]>([
  record('vendors', 'A AND D DIAGNOSTIC CORPORATION', { tin: '681-668-438-00001', address: 'Across Hall of Justice, Pusok City of Lapu-Lapu, 6015' }),
  record('vendors', 'Anthropic, PBC', { address: 'San Francisco, California' }),
  record('vendors', 'BTG Beach Management Corp.', { tin: '009-350-449-00000', address: 'Agus, Lapu-Lapu City, Cebu, 6015' }),
  record('vendors', 'Bureau of Internal Revenue'),
  record('vendors', 'Canva'),
  record('vendors', 'City of Lapu-Lapu', { address: 'City Hall, Lapu-Lapu City, 6015' }),
  record('vendors', 'Details Not Provided'),
  record('vendors', 'Ensaimada Latik Inc.', { tin: '007-017-002-00003', address: 'Unit A9 Mactan Breeze, Lapu-Lapu City, Cebu, 6015' }),
  record('vendors', 'Google Asia Pacific Pte, Ltd.', { tin: '428-076-490-00000', address: '70 Pasir Panjang Road #03-71 Mapletree Business City' }),
  record('vendors', 'GSC Gas Station', { tin: '256-687-300-00006', address: 'Saac II, Mactan, Lapu-Lapu City, 6015' }),
  record('vendors', 'Meta Platforms Ireland Limited'),
  record('vendors', 'RADIUS TELECOMS, INC.'),
  record('purchases-discount-types', 'Custom', { computation: 'Amount', account: 'Purchase Discount', allowOverride: true }),
  record('purchases-payment-terms', 'Paid Immediately', { account: 'Cash' }),
  record('purchases-payment-terms', 'Monthly for 6 Months', { payments: 6, frequency: 'Months', dueOn: 1, account: 'Accounts Payable - Trade' }),
  record('purchases-payment-terms', 'Paid full within 30 days', { dueOn: 30, account: 'Accounts Payable - Trade' }),
  record('purchases-payment-terms', 'Paid within 25 days', { dueOn: 25, account: 'Accounts Payable - Trade' }),
  record('purchases-payment-terms', 'Paid within 15 days', { dueOn: 15, account: 'Accounts Payable - Trade' }),
  record('purchases-payment-methods', 'Cash', { account: 'Cash' }),
  record('purchases-payment-methods', 'Check', { account: 'Cash' }),
  record('purchases-payment-methods', 'Others'),
  record('purchases-payment-methods', 'Bank Transfer', { account: 'Cash' }),
])

export function emptyPurchaseSetupRecord(kind: PurchaseSetupKind): PurchaseSetupRecord {
  return { ...record(kind, ''), id: '' }
}
