import { ref } from 'vue'

export type SetupKind = 'sales-payment-terms' | 'sales-payment-methods' | 'sales-discount-types'
export type PeriodUnit = 'Days' | 'Months' | 'Years'

export interface SetupRecord {
  id: string
  kind: SetupKind
  name: string
  active: boolean
  accountId: string
  /** Payment terms: number of installments (1 = a single payment). */
  payments: number
  /** Payment terms: the first (or only) payment is due this many units after the invoice date. */
  dueOn: number
  paymentDue: PeriodUnit
  /** Payment terms with several payments: later payments follow every N units. */
  frequencyEvery: number
  frequencyUnit: PeriodUnit | ''
  computation: 'Amount' | 'Percentage'
  rate: number
  allowOverride: boolean
}

export type DocumentKind = 'sales-invoices' | 'sales-receipts' | 'acknowledgement-receipts'

export interface SalesLineItem {
  id: string
  itemId: string
  description: string
  quantity: number
  unitPriceCents: number
  withholdingTaxCode: string
  withholdingTaxCents: number
  vatCode: string
  vatType: string
  vatCents: number
  /** Creditable VAT (CVAT), entered as shown on the source invoice. */
  creditableVatCents: number
}

/** One row of a receipt's "for the following invoices" table or an acknowledgement receipt's payment details. */
export interface PaymentRow {
  id: string
  /** Set when the row pays an invoice. */
  invoiceId: string
  /** Free-text description when the row is not tied to an invoice (acknowledgement receipts only). */
  others: string
  amountCents: number
}

export interface InvoiceCustomerDetails {
  /** Company or Individual, copied from the customer. */
  customerType: string
  company: string
  tin: string
  street: string
  locality: string
  country: string
  zipCode: string
}

export interface SalesDocument {
  id: string
  kind: DocumentKind
  number: string
  date: string
  customerId: string
  status: 'Draft' | 'Unpaid' | 'Paid' | 'Posted' | 'Issued' | 'Cancelled'
  paymentTermId: string
  paymentMethodId: string
  dueDate: string
  amountCents: number
  remarks: string
  customerDetails: InvoiceCustomerDetails
  discountTypeId: string
  /** Percentage rate only. Fixed discounts use discountAmountCents. */
  discountRate: number
  discountAmountCents: number
  lines: SalesLineItem[]
  /** Receipts and acknowledgement receipts. */
  payments: PaymentRow[]
  /** Acknowledgement receipts: whether the payment details refer to invoices. */
  withInvoice: boolean
}

// Preview records remain available while navigating, and reset on page reload.
export const setupRecords = ref<SetupRecord[]>([])
export const salesDocuments = ref<SalesDocument[]>([])
