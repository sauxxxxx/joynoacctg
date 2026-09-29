import type { Ref } from 'vue'
import { z, type ZodType } from 'zod'
import { companyProfile, recordingSettings, reportingSettings } from './companyStore'
import { toOptions, type FieldDef } from './recordConfig'

export interface SettingsConfig {
  description: string
  note?: string
  store: Ref<Record<string, unknown>>
  fields: FieldDef[]
  schema: ZodType
  /** Name used in the audit trail and the saved message. */
  subject: string
}

const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address.')])
const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(2024, index, 1)),
}))

const profile: SettingsConfig = {
  description: 'Legal and contact details. The company name, TIN, and address appear on printed reports.',
  store: companyProfile as unknown as Ref<Record<string, unknown>>,
  subject: 'Company profile',
  fields: [
    { section: 'Business identity', key: 'registeredName', label: 'Registered name', type: 'text', required: true, maxlength: 200 },
    { key: 'tradeName', label: 'Trade name', type: 'text', maxlength: 200, hint: 'Shown on reports when set.' },
    { key: 'organizationType', label: 'Organization type', type: 'select', options: () => toOptions(['Sole proprietorship', 'Partnership', 'Corporation', 'One Person Corporation', 'Cooperative', 'Other']) },
    { key: 'lineOfBusiness', label: 'Line of business', type: 'text', maxlength: 160 },
    { section: 'Tax registration', key: 'tin', label: 'TIN', type: 'text', maxlength: 20, placeholder: '000-000-000' },
    { key: 'branchCode', label: 'Branch code', type: 'text', maxlength: 5, placeholder: '00000' },
    { key: 'rdoCode', label: 'RDO code', type: 'text', maxlength: 5 },
    { key: 'vatRegistration', label: 'VAT registration', type: 'select', options: () => toOptions(['VAT-registered', 'Non-VAT']) },
    { section: 'Address', key: 'street', label: 'Unit, building, street, barangay', type: 'text', full: true, maxlength: 200 },
    { key: 'city', label: 'City / municipality', type: 'text', maxlength: 120 },
    { key: 'province', label: 'Province', type: 'text', maxlength: 120 },
    { key: 'zipCode', label: 'ZIP code', type: 'text', maxlength: 10 },
    { section: 'Contact', key: 'email', label: 'Email', type: 'email', maxlength: 254 },
    { key: 'phone', label: 'Phone', type: 'text', maxlength: 40 },
    { key: 'website', label: 'Website', type: 'text', maxlength: 200 },
  ],
  schema: z.object({
    registeredName: z.string().trim().min(1, 'Registered name is required.'),
    tin: z.string().regex(/^[\d-]*$/, 'TIN can contain only digits and dashes.'),
    branchCode: z.string().regex(/^\d*$/, 'Branch code can contain only digits.'),
    zipCode: z.string().regex(/^\d*$/, 'ZIP code can contain only digits.'),
    email: optionalEmail,
  }),
}

const recording: SettingsConfig = {
  description: 'How transactions are recorded. The fiscal year start is used by report periods and analytics.',
  store: recordingSettings as unknown as Ref<Record<string, unknown>>,
  subject: 'Recording settings',
  fields: [
    { section: 'Accounting period', key: 'fiscalYearStartMonth', label: 'Fiscal year starts in', type: 'select', required: true, options: () => monthOptions },
    { key: 'lockDate', label: 'Lock entries up to', type: 'date', hint: 'Stored for the journal module, which will block changes on or before this date.' },
    { section: 'Books', key: 'accountingBasis', label: 'Accounting basis', type: 'select', options: () => toOptions(['Accrual', 'Cash']) },
    { key: 'booksFormat', label: 'Books of accounts', type: 'select', options: () => toOptions(['Manual', 'Loose-leaf', 'Computerized']) },
    { key: 'baseCurrency', label: 'Base currency', type: 'select', options: () => [{ value: 'PHP', label: 'PHP · Philippine peso' }], hint: 'Other currencies are not supported yet.' },
  ],
  schema: z.object({ fiscalYearStartMonth: z.string().regex(/^(?:[1-9]|1[0-2])$/, 'Choose the fiscal year start month.') }),
}

const reporting: SettingsConfig = {
  description: 'Defaults for accounting reports. Signatories and the footer note print at the bottom of each report.',
  store: reportingSettings as unknown as Ref<Record<string, unknown>>,
  subject: 'Reporting settings',
  fields: [
    { section: 'Signatories', key: 'preparedBy', label: 'Prepared by', type: 'text', maxlength: 120 },
    { key: 'reviewedBy', label: 'Reviewed by', type: 'text', maxlength: 120 },
    { key: 'approvedBy', label: 'Approved by', type: 'text', maxlength: 120 },
    { section: 'Report defaults', key: 'includeZeroBalances', label: 'Include zero-balance accounts in the Trial Balance by default', type: 'checkbox' },
    { key: 'footerNote', label: 'Footer note', type: 'textarea', maxlength: 500 },
  ],
  schema: z.object({}),
}

export const settingsPages: Record<string, SettingsConfig> = {
  'company-profile': profile,
  'company-recording': recording,
  'company-reporting': reporting,
}
