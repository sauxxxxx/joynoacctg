import type { Ref } from 'vue'
import { companyProfile, reportingSettings } from './companyStore'
import { toOptions, type FieldDef } from './recordConfig'

export interface SettingsSection {
  title?: string
  /** Fields per row on wide screens. */
  columns?: 2 | 3
  fields: FieldDef[]
}

export interface SettingsConfig {
  store: Ref<Record<string, unknown>>
  sections: SettingsSection[]
  /** Error message for an invalid draft, or ''. */
  validate: (draft: Record<string, unknown>) => string
  /** Name used in the audit trail and the saved message. */
  subject: string
}

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: new Intl.DateTimeFormat('en-PH', { month: 'long' }).format(new Date(2024, index, 1)),
}))
const text = (value: unknown) => (typeof value === 'string' ? value : '').trim()
const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const profile: SettingsConfig = {
  store: companyProfile as unknown as Ref<Record<string, unknown>>,
  subject: 'Company profile',
  sections: [
    {
      title: 'General Information',
      fields: [
        { key: 'tin', label: 'TIN', type: 'text', maxlength: 20, placeholder: '000-000-000-00000' },
        { key: 'birRegistrationDate', label: 'BIR Registration Date', type: 'date' },
        { key: 'companyName', label: 'Company Name', type: 'text', required: true, full: true, maxlength: 120 },
        { key: 'formation', label: 'Formation', type: 'select', options: () => toOptions(['Sole Proprietorship', 'Partnership', 'Corporation', 'One Person Corporation', 'Cooperative']) },
        { key: 'natureOfBusiness', label: 'Nature Of Business', type: 'select', options: () => toOptions(['Service', 'Merchandising', 'Manufacturing', 'Mixed']) },
        { key: 'rdo', label: 'RDO', type: 'text', maxlength: 80, placeholder: 'e.g. 083 - Talisay-Minglanilla, Cebu' },
        { key: 'lineOfBusiness', label: 'Line of Business', type: 'text', maxlength: 160 },
      ],
    },
    {
      title: 'Contact Details',
      fields: [
        { key: 'telephone', label: 'Tel #', type: 'text', maxlength: 40 },
        { key: 'email', label: 'E-mail', type: 'email', maxlength: 254 },
      ],
    },
    {
      title: 'Address',
      columns: 3,
      fields: [
        { key: 'unitBuilding', label: 'Unit #, Bldg', type: 'text', maxlength: 120 },
        { key: 'street', label: 'Lot/Block/Phase/House No. & Street', type: 'text', maxlength: 160 },
        { key: 'barangay', label: 'Subdivision/Village/Zone, Barangay, Town/District', type: 'text', maxlength: 160 },
        { key: 'city', label: 'Municipality/City', type: 'text', maxlength: 120 },
        { key: 'province', label: 'Province', type: 'text', maxlength: 120 },
        { key: 'zipCode', label: 'Zip Code', type: 'text', maxlength: 10 },
        { key: 'country', label: 'Country', type: 'text', maxlength: 80 },
      ],
    },
  ],
  validate: (draft) => {
    if (!text(draft.companyName)) return 'Company Name is required.'
    if (!/^[\d-]*$/.test(text(draft.tin))) return 'TIN can contain only digits and dashes.'
    if (text(draft.email) && !isEmail(text(draft.email))) return 'Enter a valid e-mail address.'
    if (!/^\d*$/.test(text(draft.zipCode))) return 'Zip Code can contain only digits.'
    return ''
  },
}

const reporting: SettingsConfig = {
  store: reportingSettings as unknown as Ref<Record<string, unknown>>,
  subject: 'Reporting settings',
  sections: [
    {
      fields: [
        { key: 'parentCompany', label: 'Parent Company', type: 'text', maxlength: 200 },
        { key: 'monthEnd', label: 'Month End', type: 'select', required: true, options: () => monthOptions, hint: 'Last month of the fiscal year. Report periods follow it.' },
      ],
    },
    {
      title: 'Primary Signatory',
      fields: [
        { key: 'primaryName', label: 'Name', type: 'text', maxlength: 120 },
        { key: 'primaryPosition', label: 'Position', type: 'text', maxlength: 120 },
      ],
    },
    {
      title: 'Secondary Signatory',
      fields: [
        { key: 'secondaryName', label: 'Name', type: 'text', maxlength: 120 },
        { key: 'secondaryPosition', label: 'Position', type: 'text', maxlength: 120 },
      ],
    },
  ],
  validate: (draft) => {
    if (!/^(?:[1-9]|1[0-2])$/.test(text(draft.monthEnd))) return 'Choose the Month End.'
    if (text(draft.primaryPosition) && !text(draft.primaryName)) return 'Enter the primary signatory name.'
    if (text(draft.secondaryPosition) && !text(draft.secondaryName)) return 'Enter the secondary signatory name.'
    return ''
  },
}

export const settingsPages: Record<string, SettingsConfig> = {
  'company-profile': profile,
  'company-reporting': reporting,
}
