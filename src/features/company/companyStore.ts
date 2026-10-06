import { computed, ref } from 'vue'
import { isPreviewMode } from '../../services/api/config'
import { onSessionReset } from '../../services/api/session'

/**
 * Company UI state. Normal sessions load persisted company-scoped API records;
 * sample values are restricted to tests and all caches clear on session changes.
 */

export interface CompanyProfile {
  /** Data URL of the uploaded logo, or ''. */
  logo: string
  logoContainsName: boolean
  tin: string
  birRegistrationDate: string
  companyName: string
  formation: string
  natureOfBusiness: string
  rdo: string
  lineOfBusiness: string
  telephone: string
  email: string
  unitBuilding: string
  street: string
  barangay: string
  city: string
  province: string
  zipCode: string
  country: string
}

export interface ClosingEntry {
  id: string
  year: number
  entry: string
  notes: string
}

export interface RecordingSettings {
  /** When the Sales and Purchase Journals are used. */
  journalUsage: string
  /** Books are closed through the end of this month and year ('' when not set). */
  closeMonth: string
  closeYear: string
  closingEntries: ClosingEntry[]
}

export interface AccountMapping {
  id: string
  label: string
  accountId: string
  description: string
}

export interface ReportingSettings {
  parentCompany: string
  /** Last month of the fiscal year, 1–12, as a string. */
  monthEnd: string
  primaryName: string
  primaryPosition: string
  secondaryName: string
  secondaryPosition: string
}

export interface Owner {
  id: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  tin: string
  email: string
  address: string
  active: boolean
}

export interface RegisteredBook {
  id: string
  journalType: string
  format: string
}

export interface RegistrationSettings {
  taxTypes: string[]
  bookType: string
  permitNumber: string
  permitDate: string
  books: RegisteredBook[]
  invoiceTypes: string[]
  receiptTypes: string[]
}

export interface TaxActivation {
  active: boolean
  taxCode: string
  startDate: string
}

export interface TaxSettings {
  deductionMethod: string
  filingMethod: string
  taxpayerClassification: string
  incomeTaxType: string
  incomeTaxAtc: string
  vat: TaxActivation
  vatExempt: TaxActivation
  zeroRated: TaxActivation
  twa: TaxActivation
  availsTaxRelief: boolean
  taxReliefDetails: string
}

export const permissionModules = ['Sales', 'Purchases', 'Accounting', 'Government', 'Banking', 'Asset Management', 'Company', 'Documents'] as const
export const permissionActions = ['view', 'create', 'edit', 'delete'] as const
export type PermissionModule = typeof permissionModules[number]
export type PermissionAction = typeof permissionActions[number]
export type PermissionMatrix = Record<PermissionModule, Record<PermissionAction, boolean>>

export interface Role {
  id: string
  version?: number
  name: string
  description: string
  active: boolean
  system: boolean
  permissions: PermissionMatrix
}

export interface UserAccount {
  id: string
  version?: number
  password?: string
  username: string
  email: string
  name: string
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
  sellingPriceCents: number
  costCents: number
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
  version?: number
  name: string
  fileName: string
  size: number
  mimeType: string
  category: string
  reference: string
  notes: string
  uploadedAt: string
  archived: boolean
  sha256: string
}

export const companyProfile = ref<CompanyProfile>({
  logo: '', logoContainsName: false, tin: '', birRegistrationDate: '', companyName: '', formation: '', natureOfBusiness: '',
  rdo: '', lineOfBusiness: '', telephone: '', email: '', unitBuilding: '', street: '', barangay: '', city: '', province: '',
  zipCode: '', country: 'Philippines',
})
export const recordingSettings = ref<RecordingSettings>({ journalUsage: 'All invoices', closeMonth: '', closeYear: '', closingEntries: [] })
export const reportingSettings = ref<ReportingSettings>({
  parentCompany: '', monthEnd: '12', primaryName: '', primaryPosition: '', secondaryName: '', secondaryPosition: '',
})
export const registrationSettings = ref<RegistrationSettings>({
  taxTypes: [], bookType: 'Manual', permitNumber: '', permitDate: '', books: [], invoiceTypes: [], receiptTypes: [],
})
const inactiveTax = (): TaxActivation => ({ active: false, taxCode: '', startDate: '' })
export const taxSettings = ref<TaxSettings>({
  deductionMethod: '', filingMethod: '', taxpayerClassification: '', incomeTaxType: '', incomeTaxAtc: '',
  vat: inactiveTax(), vatExempt: inactiveTax(), zeroRated: inactiveTax(), twa: inactiveTax(),
  availsTaxRelief: false, taxReliefDetails: '',
})

const mapping = (label: string, accountId: string, description: string): AccountMapping => ({ id: crypto.randomUUID(), label, accountId, description })
/**
 * Default account mapping from the legacy system. Account names are placeholders until they are
 * matched to accounts in Accounting › Chart of Accounts.
 */
export const accountMappings = ref<AccountMapping[]>([
  mapping('Sales Discount', '402', 'Account for all discounts in sales'),
  mapping('Output Tax', '202', 'Account used for all accumulated VAT in sales'),
  mapping('Vatable Sales', '401', 'Account used for all vatable sales'),
  mapping('Exempt Sales', '401', 'Account used for all VAT-exempt sales'),
  mapping('Zero Rated Sales', '401', 'Account used for all zero-rated sales'),
  mapping('Non Vatable Sales', '401', 'Account used for all non-vatable sales'),
  mapping('Purchase Discount', '555', 'Account for all discounts in purchases'),
  mapping('Input Tax', '114', 'Account used for all VAT in purchases'),
  mapping('Vatable Purchases', '550', 'Account used for all vatable purchases'),
  mapping('Exempt Purchases', '550', 'Account used for all VAT-exempt purchases'),
  mapping('Zero Rated Purchases', '550', 'Account used for all zero-rated purchases'),
  mapping('Non Vatable Purchases', '550', 'Account used for all non-vatable purchases'),
  mapping('Creditable Withholding Tax', '115', 'Account used for all creditable withholding tax on sales'),
  mapping('Deferred Input Tax', '', 'Account used when deferring recognition of input tax'),
  mapping('Deferred Output Tax', '', 'Account used when deferring recognition of output tax'),
  mapping('Expanded Withholding Tax', '', 'Account used for all taxes withheld on purchases'),
  mapping('Other Non-deductible Expenses', '', 'For recording expenses with no valid source documents'),
  mapping('Deferred WTAX', '', 'Account used when deferring recognition of withholding tax'),
  mapping('Depreciation Expense', '', 'To account for depreciation expenses of fixed assets'),
  mapping('Withholding Tax Payable - Final', '', 'Account used for all final taxes withheld on purchases'),
  mapping('Taxes and Licenses', '', 'Business taxes, registration, and licensing fees paid to the government'),
  mapping('Income Tax Expense', '', 'Account used for all income tax expense'),
  mapping('Creditable Income Tax', '', 'Account used for all creditable income tax on sales'),
  mapping('Income Tax Payable', '', 'Account used for all income tax payable on sales'),
  mapping('VAT Payable', '202', 'Account used for all VAT payable on sales'),
  mapping('Cash', '101', 'Account for all cash transactions'),
  mapping('Accounts Receivable', '', 'Amounts owed by customers'),
  mapping('Accounts Payable', '', 'Amounts owed to vendors'),
  mapping('Revolving Cash Fund', '102', 'Default account for a revolving fund'),
  mapping('Creditable Input Tax', '114', 'Used to record the excess of input taxes (VAT from purchases)'),
  mapping('Prepaid Expenses', '113', 'Used to record expenses from vouchers without valid supporting documents'),
  mapping('BIR Penalties', '', 'Account used for all tax penalties'),
  mapping('Percentage Tax Payable', '', 'Account used for all percentage tax returns'),
  mapping('Withholding Tax Payable for Compensation', '', 'Account used for all taxes withheld on compensation'),
  mapping('Creditable VAT', 'Creditable VAT', 'Used to record VAT withheld from sales'),
])

export const owners = ref<Owner[]>([])
export const users = ref<UserAccount[]>([])
export const goods = ref<CompanyItem[]>([])
export const services = ref<CompanyItem[]>([])
export const otherItems = ref<CompanyItem[]>([])
export const messageTemplates = ref<MessageTemplate[]>([])
export const documentSeries = ref<DocumentSeries[]>([])
export const reportTemplates = ref<ReportTemplate[]>([])
export const auditEvents = ref<AuditEvent[]>([])
export const storedDocuments = ref<StoredDocument[]>([])
onSessionReset(() => { goods.value = []; services.value = []; otherItems.value = []; documentSeries.value = []; reportTemplates.value = []; storedDocuments.value = [] })

export function emptyPermissions(value = false): PermissionMatrix {
  return Object.fromEntries(permissionModules.map((module) => [module, Object.fromEntries(permissionActions.map((action) => [action, value]))])) as PermissionMatrix
}

// A starting role so users can be created right away. It cannot be deleted.
export const roles = ref<Role[]>([
  { id: 'role-administrator', name: 'Administrator', description: 'Full access to every module.', active: true, system: true, permissions: emptyPermissions(true) },
])
if (!isPreviewMode) {
  roles.value = []
  accountMappings.value = accountMappings.value.map((row) => ({ ...row, accountId: '' }))
}

export const addOns = ref<AddOn[]>([
  { id: 'bulk-invoice-import', name: 'Bulk invoice import', description: 'Create several sales invoices at once and exchange them with Excel.', module: 'Sales', available: true, enabled: true },
  { id: 'report-csv-export', name: 'Report CSV export', description: 'Download accounting reports and the audit trail as CSV files.', module: 'Accounting', available: true, enabled: true },
  { id: 'cloud-sync', name: 'Cloud database sync', description: 'Keep records in a shared database instead of this browser tab.', module: 'Platform', available: false, enabled: false },
  { id: 'email-delivery', name: 'Email delivery', description: 'Send message templates to customers by email.', module: 'Company', available: false, enabled: false },
])

export function isAddOnEnabled(id: string): boolean {
  return addOns.value.some((addOn) => addOn.id === id && addOn.available && addOn.enabled)
}

/** Name shown in report headers. */
export const companyDisplayName = computed(() => companyProfile.value.companyName.trim())

/** Single-line address for report headers. */
export const companyAddress = computed(() => {
  const profile = companyProfile.value
  const cityLine = [profile.city, profile.province].map((part) => part.trim()).filter(Boolean).join(', ')
  return [profile.unitBuilding, profile.street, profile.barangay, cityLine, profile.zipCode]
    .map((part) => part.trim()).filter(Boolean).join(', ')
})

/** Fiscal year starts the month after Reporting › Month End (December end → January start). */
export const fiscalYearStartMonth = computed(() => {
  const monthEnd = Number(reportingSettings.value.monthEnd)
  return Number.isInteger(monthEnd) && monthEnd >= 1 && monthEnd <= 12 ? (monthEnd % 12) + 1 : 1
})

export function ownerFullName(owner: Pick<Owner, 'firstName' | 'middleName' | 'lastName' | 'suffix'>): string {
  return [owner.firstName, owner.middleName, owner.lastName, owner.suffix].map((part) => part.trim()).filter(Boolean).join(' ')
}

// There is no sign-in yet, so every action is attributed to this preview session.
export const currentActor = 'Preview session'

export function recordAudit(module: string, action: string, reference: string, details = '') {
  if (!isPreviewMode) return
  auditEvents.value = [
    { id: crypto.randomUUID(), at: new Date().toISOString(), user: currentActor, module, action, reference, details },
    ...auditEvents.value,
  ]
}
