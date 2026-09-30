export type PurchaseReportKind = 'payable-schedule' | 'payable-aging' | 'revolving-fund-logs'

export interface PayableReportRow {
  id: string
  vendor: string
  dueDate: string
  balanceCents: number
  currentCents: number
  oneToThirtyCents: number
  thirtyOneToSixtyCents: number
  sixtyOneToNinetyCents: number
  overNinetyCents: number
}

export const payableReportRows: PayableReportRow[] = [
  {
    id: 'radius-telecoms',
    vendor: 'RADIUS TELECOMS, INC.',
    dueDate: '2026-09-15',
    balanceCents: 4_592_000,
    currentCents: 0,
    oneToThirtyCents: 4_592_000,
    thirtyOneToSixtyCents: 0,
    sixtyOneToNinetyCents: 0,
    overNinetyCents: 0,
  },
  {
    id: 'tower-one-plaza',
    vendor: 'Tower One Plaza Magellan Building Administration Inc.',
    dueDate: '2026-09-20',
    balanceCents: 5_744_605,
    currentCents: 0,
    oneToThirtyCents: 5_744_605,
    thirtyOneToSixtyCents: 0,
    sixtyOneToNinetyCents: 0,
    overNinetyCents: 0,
  },
]
