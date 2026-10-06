import { z } from 'zod'

const text = (max = 200) => z.string().trim().max(max).default('')
const date = z.union([z.literal(''), z.iso.date()]).default('')
const strings = z.array(z.string().trim().min(1).max(160)).max(100)
const tax = z.object({ active: z.boolean(), taxCode: text(160), startDate: date }).strict().refine((value) => !value.active || Boolean(value.taxCode && value.startDate), 'An active tax preference requires a code and start date.')
const profile = z.object({
  logo: z.string().max(700_000).regex(/^(?:|data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+)$/),
  logoContainsName: z.boolean(), companyName: z.string().trim().min(1).max(120),
  tin: z.string().regex(/^[\d-]*$/).max(20), birRegistrationDate: date, formation: text(), natureOfBusiness: text(),
  rdo: text(80), lineOfBusiness: text(160), telephone: text(40),
  email: z.union([z.literal(''), z.email()]).default(''), unitBuilding: text(120), street: text(160),
  barangay: text(160), city: text(120), province: text(120), zipCode: z.string().regex(/^\d*$/).max(10), country: text(80),
}).strict()
const recording = z.object({
  journalUsage: z.enum(['All invoices']), closeMonth: z.union([z.literal(''), z.string().regex(/^(?:[1-9]|1[0-2])$/)]),
  closeYear: z.union([z.literal(''), z.string().regex(/^\d{4}$/)]),
  closingEntries: z.array(z.object({ id: z.string(), year: z.number().int().min(1900).max(9999), entry: text(), notes: text(1000) }).strict()).max(100),
}).strict().refine((value) => Boolean(value.closeMonth) === Boolean(value.closeYear), 'Choose both the closing month and year.')
const reporting = z.object({ parentCompany: text(), monthEnd: z.string().regex(/^(?:[1-9]|1[0-2])$/),
  primaryName: text(120), primaryPosition: text(120), secondaryName: text(120), secondaryPosition: text(120) }).strict()
const registration = z.object({ taxTypes: strings, bookType: z.enum(['Manual', 'Loose-leaf', 'Computerized']),
  permitNumber: text(), permitDate: date,
  books: z.array(z.object({ id: z.string(), journalType: z.string().min(1).max(100), format: text() }).strict()).max(100),
  invoiceTypes: strings, receiptTypes: strings }).strict()
const taxes = z.object({ deductionMethod: text(), filingMethod: text(), taxpayerClassification: text(), incomeTaxType: text(), incomeTaxAtc: text(),
  vat: tax, vatExempt: tax, zeroRated: tax, twa: tax, availsTaxRelief: z.boolean(), taxReliefDetails: text(2000) }).strict().refine((value) => !value.availsTaxRelief || Boolean(value.taxReliefDetails), 'Enter the recorded tax relief details.')
const mappings = z.object({ rows: z.array(z.object({ id: z.string().min(1).max(100), label: z.string().min(1).max(100), accountId: text(100), description: text(500) }).strict()).max(100) }).strict()

export const settingsSchemas = { profile, recording, reporting, registration, tax: taxes, mappings }
const blankTax = () => ({ active: false, taxCode: '', startDate: '' })
export function defaultSettings(kind, companyName) {
  const defaults = {
    profile: { logo: '', logoContainsName: false, companyName, tin: '', birRegistrationDate: '', zipCode: '', country: 'Philippines' },
    recording: { journalUsage: 'All invoices', closeMonth: '', closeYear: '', closingEntries: [] },
    reporting: { monthEnd: '12' }, registration: { taxTypes: [], bookType: 'Manual', permitNumber: '', permitDate: '', books: [], invoiceTypes: [], receiptTypes: [] },
    tax: { vat: blankTax(), vatExempt: blankTax(), zeroRated: blankTax(), twa: blankTax(), availsTaxRelief: false }, mappings: { rows: [] },
  }
  return settingsSchemas[kind].parse(defaults[kind])
}
