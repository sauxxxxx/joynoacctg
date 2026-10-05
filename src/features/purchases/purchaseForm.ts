import { z } from 'zod'
import { parseIsoDate, toIsoDate } from '../../components/ui/dateUtils'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { purchaseRecords, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'

export interface PurchaseLineDraft { id: string; description: string; quantity: string; unitPrice: string }
export interface PurchaseDraft {
  number: string; date: string; vendorId: string; amount: string; tax: string; paid: string
  remarks: string; paymentMethod: string; paymentTerms: string; checkNumber: string
  month: string; year: string; period: string; payrollFrequency: string; payGroup: string; accrualJE: string
  lines: PurchaseLineDraft[]
}

export function emptyPurchaseDraft(): PurchaseDraft {
  const today = new Date()
  return { number: '', date: toIsoDate(today), vendorId: '', amount: '', tax: '0.00', paid: '0.00', remarks: '', paymentMethod: '', paymentTerms: '', checkNumber: '', month: String(today.getMonth() + 1).padStart(2, '0'), year: String(today.getFullYear()), period: '', payrollFrequency: '', payGroup: '', accrualJE: '', lines: [{ id: crypto.randomUUID(), description: '', quantity: '1', unitPrice: '' }] }
}

export function draftFromRecord(record: PurchaseRecord): PurchaseDraft {
  return { number: record.number, date: record.date, vendorId: record.vendorId, amount: formatMoney(record.amountCents).replaceAll(',', ''), tax: formatMoney(record.taxCents).replaceAll(',', ''), paid: formatMoney(record.paidCents).replaceAll(',', ''), remarks: record.remarks, paymentMethod: record.paymentMethod, paymentTerms: record.paymentTerms, checkNumber: record.checkNumber, month: record.month, year: record.year, period: record.period, payrollFrequency: record.payrollFrequency, payGroup: record.payGroup, accrualJE: record.accrualJE, lines: record.lines.map((line) => ({ id: line.id, description: line.description, quantity: String(line.quantity), unitPrice: formatMoney(line.unitPriceCents).replaceAll(',', '') })) }
}

const baseSchema = z.object({
  number: z.string().trim().min(1, 'Enter a reference number.').max(80),
  date: z.string().refine((value) => Boolean(parseIsoDate(value)), 'Choose a valid date.'),
})

export function validatePurchaseDraft(kind: PurchaseKind, draft: PurchaseDraft, existing?: PurchaseRecord): { record?: PurchaseRecord; error?: string } {
  const base = baseSchema.safeParse(draft)
  if (!base.success) return { error: base.error.issues[0]?.message ?? 'Check the record.' }
  if (purchaseRecords.value.some((item) => item.kind === kind && item.number.toLocaleLowerCase() === base.data.number.toLocaleLowerCase() && item.id !== existing?.id)) return { error: 'This reference number already exists.' }
  if (kind === 'payrolls' && (!/^\d{4}$/.test(draft.year) || !/^(0?[1-9]|1[0-2])$/.test(draft.month))) return { error: 'Enter a valid payroll month and year.' }
  if (kind !== 'payrolls' && !draft.vendorId) return { error: 'Choose a vendor or payee.' }
  if (kind === 'purchase-receipts' && !draft.paymentMethod.trim()) return { error: 'Enter a payment method.' }
  if (kind === 'check-voucher' && !draft.checkNumber.trim()) return { error: 'Enter a check number.' }

  let amountCents = 0
  const lines: PurchaseRecord['lines'] = []
  if (kind === 'purchase-invoices') {
    if (!draft.lines.length) return { error: 'Add at least one invoice line.' }
    for (const [index, line] of draft.lines.entries()) {
      const quantity = Number(line.quantity)
      const unitPriceCents = parseMoneyToCents(line.unitPrice)
      if (!line.description.trim() || !Number.isSafeInteger(quantity) || quantity < 1 || unitPriceCents === null || unitPriceCents <= 0) return { error: `Enter a description, whole-number quantity, and positive price on line ${index + 1}.` }
      const subtotal = quantity * unitPriceCents
      if (!Number.isSafeInteger(subtotal)) return { error: `Amount on line ${index + 1} is too large.` }
      amountCents += subtotal
      lines.push({ id: line.id, description: line.description.trim(), quantity, unitPriceCents })
    }
  } else {
    const parsed = parseMoneyToCents(draft.amount)
    if (parsed === null || parsed <= 0) return { error: 'Enter a positive amount with at most two decimal places.' }
    amountCents = parsed
  }
  const taxCents = kind === 'purchase-invoices' ? parseMoneyToCents(draft.tax) : 0
  if (taxCents === null || taxCents < 0) return { error: 'Enter a valid tax amount.' }
  const totalCents = amountCents + taxCents
  if (!Number.isSafeInteger(totalCents)) return { error: 'The total amount is too large.' }
  const paidCents = kind === 'purchase-invoices' ? parseMoneyToCents(draft.paid) : kind === 'purchase-receipts' ? totalCents : 0
  if (paidCents === null || paidCents < 0 || paidCents > totalCents) return { error: 'Paid amount must be between zero and the total.' }

  return { record: {
    id: existing?.id ?? crypto.randomUUID(), kind, number: base.data.number, date: base.data.date,
    vendorId: draft.vendorId, amountCents, totalCents, paidCents, taxCents, status: 'Draft',
    remarks: draft.remarks.trim(), paymentMethod: draft.paymentMethod.trim(), paymentTerms: draft.paymentTerms.trim(),
    checkNumber: draft.checkNumber.trim(), lines, month: draft.month, year: draft.year, period: draft.period.trim(),
    payrollFrequency: draft.payrollFrequency.trim(), payGroup: draft.payGroup.trim(), accrualJE: draft.accrualJE.trim(),
  } }
}
