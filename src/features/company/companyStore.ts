import { computed, ref } from 'vue'

/**
 * Company module state. Frontend preview only: data lives in memory and resets when
 * the tab reloads, like the Sales pages. Replace with persistence when the backend lands.
 */

export interface CompanyProfile {
  registeredName: string
  tradeName: string
  tin: string
  branchCode: string
  rdoCode: string
  organizationType: string
  vatRegistration: string
  lineOfBusiness: string
  street: string
  city: string
  province: string
  zipCode: string
  email: string
  phone: string
  website: string
}

export interface RecordingSettings {
  fiscalYearStartMonth: string
  accountingBasis: string
  baseCurrency: string
  booksFormat: string
  lockDate: string
}

export interface ReportingSettings {
  preparedBy: string
  reviewedBy: string
  approvedBy: string
  includeZeroBalances: boolean
  footerNote: string
}

export interface Owner {
  id: string
  name: string
  tin: string
  position: string
  ownershipPercent: number
  email: string
  address: string
  active: boolean
}

export interface Registration {
  id: string
  type: string
  number: string
  agency: string
  issuedOn: string
  expiresOn: string
  notes: string
}

export interface TaxRule {
  id: string
  code: string
  description: string
  taxType: string
  ratePercent: number
  appliesTo: string
  atc: string
  active: boolean
}

export const permissionModules = ['Sales', 'Purchases', 'Accounting', 'Government', 'Banking', 'Asset Management', 'Company', 'Documents'] as const
export const permissionActions = ['view', 'create', 'edit', 'delete'] as const
export type PermissionModule = typeof permissionModules[number]
export type PermissionAction = typeof permissionActions[number]
export type PermissionMatrix = Record<PermissionModule, Record<PermissionAction, boolean>>

export interface Role {
  id: string
  name: string
  description: string
  active: boolean
  system: boolean
  permissions: PermissionMatrix
}

export interface UserAccount {
  id: string
  name: string
  email: string
  username: string
  roleId: string
  active: boolean
}

export type ItemKind = 'goods' | 'services' | 'others'

export interface CompanyItem {
  id: string
  kind: ItemKind
  code: string
  name: string
  description: string
  unit: string
  sellingPrice: number
  cost: number
  category: string
  active: boolean
}

export interface MessageTemplate {
  id: string
  name: string
  channel: string
  purpose: string
  subject: string
  body: string
  active: boolean
}

export interface DocumentSeries {
  id: string
  documentType: string
  prefix: string
  nextNumber: number
  padding: number
  suffix: string
  resetFrequency: string
  active: boolean
}

export interface ReportTemplate {
  id: string
  name: string
  report: string
  paperSize: string
  orientation: string
  headerText: string
  footerText: string
  showSignatories: boolean
  isDefault: boolean
}

export interface AuditEvent {
  id: string
  at: string
  user: string
  module: string
  action: string
  reference: string
  details: string
}

export interface AddOn {
  id: string
  name: string
  description: string
  module: string
  /** Only add-ons that exist in this frontend can be switched on. */
  available: boolean
  enabled: boolean
}

export interface StoredDocument {
  id: string
  name: string
  fileName: string
  size: number
  mimeType: string
  category: string
  reference: string
  notes: string
  uploadedAt: string
  /** Object URL for the in-memory file. Revoked when the document is deleted. */
  url: string
}

export const companyProfile = ref<CompanyProfile>({
  registeredName: '', tradeName: '', tin: '', branchCode: '', rdoCode: '', organizationType: '', vatRegistration: '',
  lineOfBusiness: '', street: '', city: '', province: '', zipCode: '', email: '', phone: '', website: '',
})
export const recordingSettings = ref<RecordingSettings>({ fiscalYearStartMonth: '1', accountingBasis: '', baseCurrency: 'PHP', booksFormat: '', lockDate: '' })
export const reportingSettings = ref<ReportingSettings>({ preparedBy: '', reviewedBy: '', approvedBy: '', includeZeroBalances: false, footerNote: '' })

export const owners = ref<Owner[]>([])
export const registrations = ref<Registration[]>([])
export const taxRules = ref<TaxRule[]>([])
export const users = ref<UserAccount[]>([])
export const goods = ref<CompanyItem[]>([])
export const services = ref<CompanyItem[]>([])
export const otherItems = ref<CompanyItem[]>([])
export const messageTemplates = ref<MessageTemplate[]>([])
export const documentSeries = ref<DocumentSeries[]>([])
export const reportTemplates = ref<ReportTemplate[]>([])
export const auditEvents = ref<AuditEvent[]>([])
export const storedDocuments = ref<StoredDocument[]>([])

export function emptyPermissions(value = false): PermissionMatrix {
  return Object.fromEntries(permissionModules.map((module) => [module, Object.fromEntries(permissionActions.map((action) => [action, value]))])) as PermissionMatrix
}

// A starting role so users can be created right away. It cannot be deleted.
export const roles = ref<Role[]>([
  { id: 'role-administrator', name: 'Administrator', description: 'Full access to every module.', active: true, system: true, permissions: emptyPermissions(true) },
])

export const addOns = ref<AddOn[]>([
  { id: 'bulk-invoice-import', name: 'Bulk invoice import', description: 'Create several sales invoices at once and exchange them with Excel.', module: 'Sales', available: true, enabled: true },
  { id: 'report-csv-export', name: 'Report CSV export', description: 'Download accounting reports and the audit trail as CSV files.', module: 'Accounting', available: true, enabled: true },
  { id: 'cloud-sync', name: 'Cloud database sync', description: 'Keep records in a shared database instead of this browser tab.', module: 'Platform', available: false, enabled: false },
  { id: 'email-delivery', name: 'Email delivery', description: 'Send message templates to customers by email.', module: 'Company', available: false, enabled: false },
])

export function isAddOnEnabled(id: string): boolean {
  return addOns.value.some((addOn) => addOn.id === id && addOn.available && addOn.enabled)
}

/** Name shown in report headers: trade name, then registered name. */
export const companyDisplayName = computed(() => companyProfile.value.tradeName.trim() || companyProfile.value.registeredName.trim())
export const fiscalYearStartMonth = computed(() => {
  const month = Number(recordingSettings.value.fiscalYearStartMonth)
  return Number.isInteger(month) && month >= 1 && month <= 12 ? month : 1
})

// There is no sign-in yet, so every action is attributed to this preview session.
export const currentActor = 'Preview session'

export function recordAudit(module: string, action: string, reference: string, details = '') {
  auditEvents.value = [
    { id: crypto.randomUUID(), at: new Date().toISOString(), user: currentActor, module, action, reference, details },
    ...auditEvents.value,
  ]
}
