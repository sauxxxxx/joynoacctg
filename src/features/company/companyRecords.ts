import { z } from 'zod'
import { todayIso } from '../accounting/reports/reportPeriods'
import {
  companyDisplayName, documentSeries, goods, messageTemplates, otherItems, ownerFullName, owners, reportTemplates, roles,
  services, users, type CompanyItem, type DocumentSeries, type ItemKind, type MessageTemplate, type Owner, type UserAccount,
} from './companyStore'
import { defineRecords, sameText, text, toOptions, type AnyRecord, type FieldDef, type RecordsConfig } from './recordConfig'

const required = (label: string) => z.string().trim().min(1, `${label} is required.`)
const optionalEmail = z.union([z.literal(''), z.email('Enter a valid email address.')])
const amountField = (label: string) => z.number(`${label} must be a number.`).finite().min(0, `${label} cannot be negative.`)
const peso = (value: unknown) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value) || 0)
const duplicate = (others: AnyRecord[], draft: AnyRecord, key: string) => others.some((record) => sameText(record[key], draft[key]))

// ------------------------------------------------------------------ Owners

const owners$ = defineRecords<Owner>({
  singular: 'owner',
  plural: 'owners',
  heading: 'Owners',
  description: 'Owners, partners, or stockholders of the company.',
  store: owners,
  auditModule: 'Company',
  empty: () => ({ firstName: '', middleName: '', lastName: '', suffix: '', tin: '', email: '', address: '', active: true }),
  fields: [
    { key: 'firstName', label: 'First Name', type: 'text', required: true, maxlength: 80 },
    { key: 'middleName', label: 'Middle Name', type: 'text', maxlength: 80 },
    { key: 'lastName', label: 'Last Name', type: 'text', required: true, maxlength: 80 },
    { key: 'suffix', label: 'Suffix', type: 'text', maxlength: 10, placeholder: 'e.g. Jr., III' },
    { key: 'tin', label: 'TIN', type: 'text', maxlength: 20 },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'address', label: 'Address', type: 'textarea', maxlength: 500 },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'First Name', value: (r) => text(r, 'firstName') },
    { label: 'Middle Name', value: (r) => String(r.middleName ?? '') },
    { label: 'Last Name', value: (r) => String(r.lastName ?? '') },
    { label: 'Suffix', value: (r) => String(r.suffix ?? '') },
    { label: 'Active', value: () => '', check: (r) => Boolean(r.active) },
  ],
  schema: z.object({
    firstName: required('First name'),
    lastName: required('Last name'),
    tin: z.string().regex(/^[\d-]*$/, 'TIN can contain only digits and dashes.'),
    email: optionalEmail,
  }),
  label: (r) => ownerFullName(r as unknown as Owner),
  searchText: (r) => `${ownerFullName(r as unknown as Owner)} ${r.tin} ${r.email}`,
})

// ------------------------------------------------------------------ Users

const users$ = defineRecords<UserAccount>({
  singular: 'user',
  plural: 'users',
  heading: 'Users',
  description: 'People who work in this accounting system and the role each one has.',
  note: 'Sign-in is not connected yet, so these accounts do not grant access. Roles describe the intended permissions.',
  store: users,
  auditModule: 'Company',
  empty: () => ({ username: '', email: '', name: '', roleId: '', active: true }),
  fields: [
    { key: 'username', label: 'Username', type: 'text', required: true, maxlength: 254, hint: 'Usually the email address.' },
    { key: 'email', label: 'Email', type: 'email', required: true, maxlength: 254 },
    { key: 'name', label: 'Name', type: 'text', required: true, full: true },
    {
      key: 'roleId', label: 'Role', type: 'select', required: true,
      options: () => roles.value.map((role) => ({ value: role.id, label: role.active ? role.name : `${role.name} (inactive)`, disabled: !role.active })),
    },
    { key: 'active', label: 'Active', type: 'checkbox' },
  ],
  columns: [
    { label: 'Username', value: (r) => text(r, 'username') },
    { label: 'Email', value: (r) => text(r, 'email') },
    { label: 'Name', value: (r) => text(r, 'name') },
    { label: 'Status', value: (r) => r.active ? 'Active' : 'Inactive', strong: true },
  ],
  schema: z.object({
    username: z.string().trim().regex(/^[a-z0-9._@+-]{3,254}$/i, 'Username needs 3 or more letters, numbers, or . _ @ + - characters.'),
    email: z.email('Enter a valid email address.'),
    name: required('Name'),
    roleId: required('Role'),
  }),
  validate: (draft, others) => {
    if (duplicate(others, draft, 'email')) return 'Another user already has this email.'
    if (duplicate(others, draft, 'username')) return 'This username is taken.'
    return ''
  },
  label: (r) => String(r.name),
  searchText: (r) => `${r.username} ${r.email} ${r.name}`,
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
      { label: 'Active?', value: () => '', check: (r: AnyRecord) => Boolean(r.active) },
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
    { label: 'Active?', value: () => '', check: (r: AnyRecord) => Boolean(r.active) },
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
    { label: 'Active?', value: () => '', check: (r: AnyRecord) => Boolean(r.active) },
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
  note: 'Printed reports currently use the signatories from Company › Reporting. Templates will apply once the print layout supports them.',
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
  users: users$,
  goods: itemConfig('goods', goods, { singular: 'good', plural: 'goods', description: 'Products you sell or buy, with their unit and prices.', unit: 'Unit', unitHint: 'e.g. pc, box, kg', price: 'Selling price', showCost: true }),
  services: itemConfig('services', services, { singular: 'service', plural: 'services', description: 'Services you bill for, with their billing unit and rate.', unit: 'Billing unit', unitHint: 'e.g. hour, project', price: 'Rate', showCost: false }),
  'other-items': itemConfig('others', otherItems, { singular: 'item', plural: 'other items', description: 'Charges that are neither goods nor services, such as fees or reimbursements.', unit: 'Unit', unitHint: 'e.g. lot', price: 'Amount', showCost: false }),
  'message-templates': messageTemplates$,
  series: series$,
  'report-templates': reportTemplates$,
}
