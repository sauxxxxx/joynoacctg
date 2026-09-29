import { ref } from 'vue'

export type SetupKind = 'sales-payment-terms' | 'sales-payment-methods' | 'sales-discount-types'

export interface SetupRecord {
  id: string
  kind: SetupKind
  name: string
  active: boolean
  account: string
  payments: number
  frequency: string
  dueOn: number
  paymentDue: 'Days' | 'Months'
  computation: 'Amount' | 'Percentage'
  rate: number
  allowOverride: boolean
}

export type DocumentKind = 'sales-invoices' | 'sales-receipts' | 'acknowledgement-receipts'

export interface SalesLineItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  withholdingTaxCode: string
  withholdingTaxAmount: number
  vatCode: string
  vatType: string
  vatAmount: number
}

export interface InvoiceCustomerDetails {
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
  invoiceId: string
  dueDate: string
  amount: number
  remarks: string
  customerDetails: InvoiceCustomerDetails
  discountTypeId: string
  discountRate: number
  lines: SalesLineItem[]
}

// Preview records remain available while navigating, and reset on page reload.
export const setupRecords = ref<SetupRecord[]>([])
export const salesDocuments = ref<SalesDocument[]>([])
