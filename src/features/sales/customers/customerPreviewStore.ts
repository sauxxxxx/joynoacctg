import { ref } from 'vue'

export interface Customer {
  id: string
  name: string
  tin: string
  contactPerson: string
  email: string
  phone: string
  address: string
  active: boolean
}

// Frontend-only state survives page navigation, but resets when the tab reloads.
export const customers = ref<Customer[]>([])
