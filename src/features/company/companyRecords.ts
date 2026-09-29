import { z } from 'zod'
import { formatShortDate, todayIso } from '../accounting/reports/reportPeriods'
import {
  companyDisplayName, documentSeries, goods, messageTemplates, otherItems, owners, registrations, reportTemplates, roles,
  services, taxRules, users, type CompanyItem, type DocumentSeries, type ItemKind, type MessageTemplate,
} from './companyStore'
import { activeBadge, defineRecords, sameText, text, toOptions, type AnyRecord, type FieldDef, type RecordsConfig } from './recordConfig'

const required = (label: string) => z.string().trim().min(1, `${label} is required.`)
const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address.')])
const amountField = (label: string) => z.number(`${label} must be a number.`).finite().min(0, `${label} cannot be negative.`)
const peso = (value: unknown) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const dayDiff = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
const duplicate = (others: AnyRecord[], draft: AnyRecord, key: string) => others.some((record) => sameText(record[key], draft[key]))

// ------------------------------------------------------------------ Owners

const owners$ = defineRecords({
  singular: 'owner',
  plural: 'owners',
  description: 'Owners, partners, or stockholders and their share in the business.',
  store: owners,
  auditModule: 'Company',
  empty: () => ({ name: '', tin: '', position: '', ownershipPercent: 0, email: '', address: '', active: true }),
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'position', label: 'Position', type: 'text', placeholder: 'e.g. Managing Partner' },
    { key: 'tin', label: 'TIN', type: 'text', maxlength: 30 },
    { key: 'ownershipPercent', label: 'Ownership', type: 'percent', required: true },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', maxlength: 500 },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Name', value: (r) => text(r, 'name'), sub: (r) => String(r.position ?? ''), strong: true },
    { label: 'TIN', value: (r) => text(r, 'tin') },
    { label: 'Ownership', value: (r) => `${Number(r.ownershipPercent).toFixed(2)}%`, numeric: true },
    { label: 'Email', value: (r) => text(r, 'email') },
    { label: 'Status', value: () => '', badge: activeBadge },
  ],
  schema: z.object({
    name: required('Full name'),
    ownershipPercent: z.number('Ownership must be a number.').min(0, 'Ownership cannot be negative.').max(100, 'Ownership cannot exceed 100%.'),
    email: optionalEmail,
  }),
  // Shares above 100% in total are impossible, so this is enforced rather than warned.
  validate: (draft, others) => {
    const total = others.filter((record) => record.active).reduce((sum, record) => sum + Number(record.ownershipPercent), 0) + (draft.active ? Number(draft.ownershipPercent) : 0)
    return total > 100.0001 ? `Active owners would total ${total.toFixed(2)}%. The total cannot exceed 100%.` : ''
  },
  label: (r) => String(r.name),
  searchText: (r) => `${r.name} ${r.tin} ${r.position} ${r.email}`,
  footer: (records) => `Active ownership recorded: ${records.filter((r) => r.active).reduce((sum, r) => sum + Number(r.ownershipPercent), 0).toFixed(2)}%`,
})

// ------------------------------------------------------------------ Registration

const registrationTypes = [
  'BIR Certificate of Registration', 'SEC Registration', 'DTI Registration', 'CDA Registration', "Mayor's / Business Permit",
  'Barangay Clearance', 'SSS Employer Registration', 'PhilHealth Employer Registration', 'Pag-IBIG Employer Registration', 'Other',
] as const
const reminderDays = 30

function registrationStatus(record: AnyRecord) {
  const expires = String(record.expiresOn ?? '')
  if (!expires) return { text: 'No expiry', tone: 'muted' as const }
  const days = dayDiff(todayIso(), expires)
  if (days < 0) return { text: 'Expired', tone: 'danger' as const }
  if (days <= reminderDays) return { text: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}`, tone: 'warning' as const }
  return { text: 'Valid', tone: 'success' as const }
}

const registrations$ = defineRecords({
  singular: 'registration',
  plural: 'registrations',
  description: 'Government registrations, permits, and certificates, with expiry tracking.',
  note: `Records expiring within ${reminderDays} days are marked for renewal. This is a display reminder only.`,
  store: registrations,
  auditModule: 'Company',
  empty: () => ({ type: '', number: '', agency: '', issuedOn: '', expiresOn: '', notes: '' }),
  fields: [
    { key: 'type', label: 'Registration type', type: 'select', required: true, options: () => toOptions(registrationTypes) },
    { key: 'number', label: 'Registration number', type: 'text', required: true, maxlength: 60 },
    { key: 'agency', label: 'Issuing office', type: 'text', placeholder: 'e.g. RDO, LGU, or branch' },
    { key: 'issuedOn', label: 'Issued on', type: 'date' },
    { key: 'expiresOn', label: 'Expires on', type: 'date', hint: 'Leave blank if it does not expire.' },
    { key: 'notes', label: 'Notes', type: 'textarea', maxlength: 500 },
  ],
  columns: [
    { label: 'Type', value: (r) => text(r, 'type'), strong: true },
    { label: 'Number', value: (r) => text(r, 'number') },
    { label: 'Issuing office', value: (r) => text(r, 'agency') },
    { label: 'Issued', value: (r) => r.issuedOn ? formatShortDate(String(r.issuedOn)) : '—' },
    { label: 'Expires', value: (r) => r.expiresOn ? formatShortDate(String(r.expiresOn)) : '—' },
    { label: 'Status', value: () => '', badge: registrationStatus },
  ],
  schema: z.object({ type: required('Registration type'), number: required('Registration number'), issuedOn: z.string(), expiresOn: z.string() })
    .refine((r) => !r.issuedOn || !r.expiresOn || r.expiresOn >= r.issuedOn, 'The expiry date must be on or after the issue date.'),
  label: (r) => `${r.type} ${r.number}`,
  searchText: (r) => `${r.type} ${r.number} ${r.agency} ${r.notes}`,
})

// ------------------------------------------------------------------ Tax rules

const taxTypes = ['Value-added tax', 'Percentage tax', 'Expanded withholding', 'Final withholding', 'Withholding on compensation', 'Other'] as const

const taxRules$ = defineRecords({
  singular: 'tax rule',
  plural: 'tax rules',
  description: 'Tax codes your team uses on sales and purchase documents.',
  note: 'Rates are entered by your team. The system does not supply or verify official BIR rates or ATCs, so confirm each one against current regulations.',
  store: taxRules,
  auditModule: 'Company',
  empty: () => ({ code: '', description: '', taxType: '', ratePercent: 0, appliesTo: 'Both', atc: '', active: true }),
  fields: [
    { key: 'code', label: 'Tax code', type: 'text', required: true, maxlength: 30 },
    { key: 'taxType', label: 'Tax type', type: 'select', required: true, options: () => toOptions(taxTypes) },
    { key: 'description', label: 'Description', type: 'text', required: true, full: true },
    { key: 'ratePercent', label: 'Rate', type: 'percent', required: true },
    { key: 'appliesTo', label: 'Applies to', type: 'select', options: () => toOptions(['Sales', 'Purchases', 'Both']) },
    { key: 'atc', label: 'ATC', type: 'text', maxlength: 20, hint: 'Alphanumeric tax code, if applicable.' },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Code', value: (r) => text(r, 'code'), strong: true },
    { label: 'Description', value: (r) => text(r, 'description'), sub: (r) => String(r.taxType ?? '') },
    { label: 'Rate', value: (r) => `${Number(r.ratePercent).toFixed(2)}%`, numeric: true },
    { label: 'Applies to', value: (r) => text(r, 'appliesTo') },
    { label: 'ATC', value: (r) => text(r, 'atc') },
    { label: 'Status', value: () => '', badge: activeBadge },
  ],
  schema: z.object({
    code: required('Tax code'),
    taxType: required('Tax type'),
    description: required('Description'),
    ratePercent: z.number('Rate must be a number.').min(0, 'Rate cannot be negative.').max(100, 'Rate cannot exceed 100%.'),
  }),
  validate: (draft, others) => duplicate(others, draft, 'code') ? 'This tax code is already in use.' : '',
  label: (r) => String(r.code),
  searchText: (r) => `${r.code} ${r.description} ${r.taxType} ${r.atc}`,
})

// ------------------------------------------------------------------ Users

const users$ = defineRecords({
  singular: 'user',
  plural: 'users',
  description: 'People who work in this accounting system and the role each one has.',
  note: 'Sign-in is not connected yet, so these accounts do not grant access. Roles describe the intended permissions.',
  store: users,
  auditModule: 'Company',
  empty: () => ({ name: '', email: '', username: '', roleId: '', active: true }),
  fields: [
    { key: 'name', label: 'Full name', type: 'text', required: true },
    { key: 'email', label: 'Email', type: 'email', required: true, maxlength: 254 },
    { key: 'username', label: 'Username', type: 'text', required: true, maxlength: 40 },
    {
      key: 'roleId', label: 'Role', type: 'select', required: true,
      options: () => roles.value.map((role) => ({ value: role.id, label: role.active ? role.name : `${role.name} (inactive)`, disabled: !role.active })),
    },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Name', value: (r) => text(r, 'name'), sub: (r) => String(r.email ?? ''), strong: true },
    { label: 'Username', value: (r) => text(r, 'username') },
    { label: 'Role', value: (r) => roles.value.find((role) => role.id === r.roleId)?.name ?? 'Unknown role' },
    { label: 'Status', value: () => '', badge: activeBadge },
  ],
  schema: z.object({
    name: required('Full name'),
    email: z.email('Enter a valid email address.'),
    username: z.string().trim().regex(/^[a-z0-9._-]{3,40}$/i, 'Username needs 3–40 letters, numbers, dots, dashes, or underscores.'),
    roleId: required('Role'),
  }),
  validate: (draft, others) => {
    if (duplicate(others, draft, 'email')) return 'Another user already has this email.'
    if (duplicate(others, draft, 'username')) return 'This username is taken.'
    return ''
  },
  label: (r) => String(r.name),
  searchText: (r) => `${r.name} ${r.email} ${r.username}`,
})

// ------------------------------------------------------------------ Items

function itemConfig(kind: ItemKind, store: typeof goods, words: { singular: string; plural: string; description: string; unit: string; unitHint: string; price: string; showCost: boolean }): RecordsConfig {
  const fields: FieldDef[] = [
    { key: 'code', label: 'Code', type: 'text', required: true, maxlength: 40 },
    { key: 'name', label: 'Name', type: 'text', required: true },
    { key: 'description', label: 'Description', type: 'textarea', maxlength: 500 },
    { key: 'unit', label: words.unit, type: 'text', maxlength: 30, placeholder: words.unitHint },
    { key: 'category', label: 'Category', type: 'text', maxlength: 80 },
    { key: 'sellingPrice', label: words.price, type: 'money' },
    ...(words.showCost ? [{ key: 'cost', label: 'Cost', type: 'money' } as FieldDef] : []),
    { key: 'active', label: 'Active', type: 'checkbox' },
  ]
  return defineRecords<CompanyItem>({
    singular: words.singular,
    plural: words.plural,
    description: words.description,
    store,
    auditModule: 'Company',
    empty: () => ({ kind, code: '', name: '', description: '', unit: '', sellingPrice: 0, cost: 0, category: '', active: true }),
    fields,
    columns: [
      { label: 'Code', value: (r) => text(r, 'code') },
      { label: 'Name', value: (r) => text(r, 'name'), sub: (r) => String(r.category ?? ''), strong: true },
      { label: words.unit, value: (r) => text(r, 'unit') },
      { label: words.price, value: (r) => peso(r.sellingPrice), numeric: true },
      ...(words.showCost ? [{ label: 'Cost', value: (r: AnyRecord) => peso(r.cost), numeric: true }] : []),
      { label: 'Status', value: () => '', badge: activeBadge },
    ],
    schema: z.object({ code: required('Code'), name: required('Name'), sellingPrice: amountField(words.price), cost: amountField('Cost') }),
    validate: (draft, others) => duplicate(others, draft, 'code') ? 'This code is already in use.' : '',
    label: (r) => `${r.code} ${r.name}`,
    searchText: (r) => `${r.code} ${r.name} ${r.description} ${r.category}`,
  })
}

// ------------------------------------------------------------------ Message templates

export const templatePlaceholders: Record<string, string> = {
  company_name: 'Your company',
  customer_name: 'ABC Corporation',
  document_number: 'INV-0001',
  amount: '₱125,000.00',
  due_date: 'October 28, 2026',
}

function renderTemplate(value: string): string {
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
    key === 'company_name' ? companyDisplayName.value || templatePlaceholders.company_name : templatePlaceholders[key] ?? match)
}

function unknownPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]).filter((key) => !(key in templatePlaceholders))
}

const messageTemplates$ = defineRecords<MessageTemplate>({
  singular: 'message template',
  plural: 'message templates',
  description: 'Reusable wording for invoices, receipts, and reminders.',
  note: 'Sending is not available yet (see Add-ons). Templates can be prepared and previewed now.',
  store: messageTemplates,
  auditModule: 'Company',
  empty: () => ({ name: '', channel: 'Email', purpose: 'Invoice', subject: '', body: '', active: true }),
  fields: [
    { key: 'name', label: 'Template name', type: 'text', required: true },
    { key: 'channel', label: 'Channel', type: 'select', options: () => toOptions(['Email', 'SMS']) },
    { key: 'purpose', label: 'Used for', type: 'select', options: () => toOptions(['Invoice', 'Receipt', 'Payment reminder', 'Statement of account', 'General']) },
    { key: 'subject', label: 'Subject', type: 'text', required: true, full: true, when: (d) => d.channel === 'Email' },
    {
      key: 'body', label: 'Message', type: 'textarea', required: true, maxlength: 4000,
      hint: `Placeholders: ${Object.keys(templatePlaceholders).map((key) => `{{${key}}}`).join(' ')}`,
    },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Name', value: (r) => text(r, 'name'), sub: (r) => r.channel === 'Email' ? String(r.subject ?? '') : '', strong: true },
    { label: 'Channel', value: (r) => text(r, 'channel') },
    { label: 'Used for', value: (r) => text(r, 'purpose') },
    { label: 'Status', value: () => '', badge: activeBadge },
  ],
  schema: z.object({ name: required('Template name'), channel: z.string(), subject: z.string(), body: required('Message') })
    .refine((r) => r.channel !== 'Email' || r.subject.trim(), 'Email templates need a subject.'),
  validate: (draft, others) => {
    const unknown = unknownPlaceholders(`${draft.subject ?? ''} ${draft.body ?? ''}`)
    if (unknown.length) return `Unknown placeholder: {{${unknown[0]}}}.`
    if (draft.channel === 'SMS' && String(draft.body).length > 480) return 'SMS templates are limited to 480 characters here.'
    return duplicate(others, draft, 'name') ? 'Another template has this name.' : ''
  },
  preview: (draft) => ({
    heading: draft.channel === 'Email' ? renderTemplate(String(draft.subject ?? '')) : '',
    body: renderTemplate(String(draft.body ?? '')) || 'Type a message to see it with sample values.',
  }),
  label: (r) => String(r.name),
  searchText: (r) => `${r.name} ${r.channel} ${r.purpose} ${r.subject} ${r.body}`,
})

// ------------------------------------------------------------------ Series

export function formatSeriesNumber(series: Pick<DocumentSeries, 'prefix' | 'suffix' | 'nextNumber' | 'padding'>, date = todayIso()): string {
  const tokens = (value: string) => value.replace(/\{YYYY\}/g, date.slice(0, 4)).replace(/\{YY\}/g, date.slice(2, 4)).replace(/\{MM\}/g, date.slice(5, 7))
  return `${tokens(series.prefix)}${String(series.nextNumber).padStart(series.padding, '0')}${tokens(series.suffix)}`
}

const series$ = defineRecords<DocumentSeries>({
  singular: 'series',
  plural: 'series',
  description: 'Numbering for company documents. One active series per document type.',
  note: 'Series are kept here for reference. Sales documents still take a typed number until numbering rules are confirmed.',
  store: documentSeries,
  auditModule: 'Company',
  empty: () => ({ documentType: '', prefix: '', nextNumber: 1, padding: 6, suffix: '', resetFrequency: 'Never', active: true }),
  fields: [
    { key: 'documentType', label: 'Document type', type: 'select', required: true, options: () => toOptions(['Sales invoice', 'Collection receipt', 'Acknowledgement receipt', 'Journal voucher', 'Other']) },
    { key: 'resetFrequency', label: 'Restart numbering', type: 'select', options: () => toOptions(['Never', 'Yearly', 'Monthly']) },
    { key: 'prefix', label: 'Prefix', type: 'text', maxlength: 20, placeholder: 'e.g. INV-{YYYY}-', hint: 'Tokens: {YYYY} {YY} {MM}' },
    { key: 'suffix', label: 'Suffix', type: 'text', maxlength: 20 },
    { key: 'nextNumber', label: 'Next number', type: 'number', required: true, min: 1 },
    { key: 'padding', label: 'Digits', type: 'number', min: 1, max: 10, hint: 'Pads with leading zeros.' },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Document type', value: (r) => text(r, 'documentType'), strong: true },
    { label: 'Next number', value: (r) => formatSeriesNumber(r as unknown as DocumentSeries) },
    { label: 'Restarts', value: (r) => text(r, 'resetFrequency') },
    { label: 'Status', value: () => '', badge: activeBadge },
  ],
  schema: z.object({
    documentType: required('Document type'),
    nextNumber: z.number('Next number must be a whole number.').int('Next number must be a whole number.').min(1, 'Next number must be at least 1.'),
    padding: z.number('Digits must be a whole number.').int('Digits must be a whole number.').min(1, 'Use 1 to 10 digits.').max(10, 'Use 1 to 10 digits.'),
  }),
  validate: (draft, others) => draft.active && others.some((r) => r.active && r.documentType === draft.documentType)
    ? `${draft.documentType} already has an active series. Deactivate it first.`
    : '',
  preview: (draft) => ({ heading: 'Next document number', body: formatSeriesNumber({ prefix: String(draft.prefix ?? ''), suffix: String(draft.suffix ?? ''), nextNumber: Number(draft.nextNumber) || 1, padding: Math.min(10, Math.max(1, Number(draft.padding) || 1)) }) }),
  label: (r) => `${r.documentType} series`,
  searchText: (r) => `${r.documentType} ${r.prefix} ${r.suffix}`,
})

// ------------------------------------------------------------------ Report templates

const reportNames = ['General Ledger (Detailed)', 'Trial Balance', 'Income Statement', 'Income Statement (Simplified)', 'Monthly Income Statement (Simplified)', 'Summary of Sales', 'Balance Sheet'] as const

const reportTemplates$ = defineRecords({
  singular: 'report template',
  plural: 'report templates',
  description: 'Page setup and wording for printed accounting reports.',
  note: 'Printed reports currently use the signatories and footer from Company › Reporting. Templates will apply once the print layout supports them.',
  store: reportTemplates,
  auditModule: 'Company',
  empty: () => ({ name: '', report: '', paperSize: 'A4', orientation: 'Portrait', headerText: '', footerText: '', showSignatories: true, isDefault: false }),
  fields: [
    { key: 'name', label: 'Template name', type: 'text', required: true },
    { key: 'report', label: 'Report', type: 'select', required: true, options: () => toOptions(reportNames) },
    { key: 'paperSize', label: 'Paper size', type: 'select', options: () => toOptions(['A4', 'Letter', 'Legal']) },
    { key: 'orientation', label: 'Orientation', type: 'select', options: () => toOptions(['Portrait', 'Landscape']) },
    { key: 'headerText', label: 'Header text', type: 'textarea', maxlength: 500 },
    { key: 'footerText', label: 'Footer text', type: 'textarea', maxlength: 500 },
    { key: 'showSignatories', label: 'Show signatories', type: 'checkbox' },
    { key: 'isDefault', label: 'Default for this report', type: 'checkbox' },
  ],
  columns: [
    { label: 'Name', value: (r) => text(r, 'name'), strong: true },
    { label: 'Report', value: (r) => text(r, 'report') },
    { label: 'Page', value: (r) => `${r.paperSize} · ${r.orientation}` },
    { label: 'Default', value: () => '', badge: (r) => r.isDefault ? { text: 'Default', tone: 'info' } : { text: 'No', tone: 'muted' } },
  ],
  schema: z.object({ name: required('Template name'), report: required('Report') }),
  validate: (draft, others) => draft.isDefault && others.some((r) => r.isDefault && r.report === draft.report)
    ? `${draft.report} already has a default template.`
    : '',
  label: (r) => String(r.name),
  searchText: (r) => `${r.name} ${r.report}`,
})

export const recordPages: Record<string, RecordsConfig> = {
  'company-owners': owners$,
  'company-registration': registrations$,
  'company-tax-rules': taxRules$,
  users: users$,
  goods: itemConfig('goods', goods, { singular: 'good', plural: 'goods', description: 'Products you sell or buy, with their unit and prices.', unit: 'Unit', unitHint: 'e.g. pc, box, kg', price: 'Selling price', showCost: true }),
  services: itemConfig('services', services, { singular: 'service', plural: 'services', description: 'Services you bill for, with their billing unit and rate.', unit: 'Billing unit', unitHint: 'e.g. hour, project', price: 'Rate', showCost: false }),
  'other-items': itemConfig('others', otherItems, { singular: 'item', plural: 'other items', description: 'Charges that are neither goods nor services, such as fees or reimbursements.', unit: 'Unit', unitHint: 'e.g. lot', price: 'Amount', showCost: false }),
  'message-templates': messageTemplates$,
  series: series$,
  'report-templates': reportTemplates$,
}
