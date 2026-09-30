import { ref } from 'vue'

export type CustomerType = 'Company' | 'Individual'

export interface Customer {
  id: string
  customerType: CustomerType
  /** Company name, or the person's full name for an individual. */
  name: string
  tradeName: string
  isDefault: boolean
  active: boolean
  unitBuilding: string
  /** District/Town, City, Province. */
  locality: string
  country: string
  zipCode: string
  tin: string
  lineOfBusiness: string
  withholding: boolean
  topWithholdingAgent: boolean
  contactPerson: string
  email: string
  phone: string
  fax: string
}

export function blankCustomer(): Omit<Customer, 'id'> {
  return {
    customerType: 'Company', name: '', tradeName: '', isDefault: false, active: true, unitBuilding: '', locality: '',
    country: 'Philippines', zipCode: '', tin: '', lineOfBusiness: '', withholding: false, topWithholdingAgent: false,
    contactPerson: '', email: '', phone: '', fax: '',
  }
}

/** Address on one line, as shown in the customer list. */
export function customerAddress(customer: Pick<Customer, 'unitBuilding' | 'locality' | 'zipCode'>): string {
  return [customer.unitBuilding, customer.locality, customer.zipCode].map((part) => part.trim()).filter(Boolean).join(', ')
}

// Frontend-only state survives page navigation, but resets when the tab reloads.
export const customers = ref<Customer[]>([])
