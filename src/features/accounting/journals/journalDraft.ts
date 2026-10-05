import { z } from 'zod'
import { parseIsoDate } from '../../../components/ui/dateUtils'
import { accounts } from '../setup/accountSetupData'
import type { GeneralJournalType, JournalPreviewEntry } from './journalPreviewData'
import type { PurchaseJournalLine } from './purchaseJournalData'

export interface JournalDraftLineInput {
  accountId: string
  debit: string
  credit: string
  remarks: string
}

export interface JournalDraftInput {
  journalNumber: string
  journalType: GeneralJournalType | ''
  date: string
  remarks: string
  lines: JournalDraftLineInput[]
}

const headerSchema = z.object({
  journalNumber: z.string().trim().min(1, 'A General Journal number is required.'),
  journalType: z.enum(['Adjusting Entry', 'Reversing Entry', 'Beginning Balance', 'Closing Entry'], { message: 'Choose a General Journal type.' }),
  date: z.string().refine((value) => Boolean(parseIsoDate(value)), 'Choose a valid date.'),
  remarks: z.string(),
})

export function amountInCents(value: string): number | null {
  const amount = value.trim()
  if (!amount) return 0
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount)) return null
  const [whole, fraction = ''] = amount.split('.')
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(cents) ? cents : null
}

export function validateJournalDraft(input: JournalDraftInput, existing?: JournalPreviewEntry): { entry?: JournalPreviewEntry; error?: string } {
  const header = headerSchema.safeParse(input)
  if (!header.success) return { error: header.error.issues[0]?.message ?? 'Check the journal entry.' }
  if (input.lines.length < 2) return { error: 'Add at least two accounting lines.' }

  const lines: PurchaseJournalLine[] = []
  let totalDebit = 0
  let totalCredit = 0
  for (const [index, line] of input.lines.entries()) {
    if (!line.accountId.trim()) return { error: `Enter an account on line ${index + 1}.` }
    if (!accounts.value.some((account) => account.active && account.code === line.accountId.trim())) {
      return { error: `Choose an active Chart of Accounts entry on line ${index + 1}.` }
    }
    const debitCents = amountInCents(line.debit)
    const creditCents = amountInCents(line.credit)
    if (debitCents === null || creditCents === null) return { error: `Enter a valid amount on line ${index + 1}.` }
    if ((debitCents > 0) === (creditCents > 0)) return { error: `Enter either a debit or a credit on line ${index + 1}.` }
    totalDebit += debitCents
    totalCredit += creditCents
    lines.push({ accountId: line.accountId.trim(), debitCents, creditCents, remarks: line.remarks.trim() })
  }
  if (totalDebit !== totalCredit) return { error: 'Debits and credits must balance before saving.' }

  return {
    entry: {
      id: existing?.id ?? crypto.randomUUID(), kind: 'general-journal', journalNumber: header.data.journalNumber, referenceNumber: '',
      date: header.data.date, party: '', amountCents: totalDebit, status: 'Draft',
      remarks: header.data.remarks.trim(), createdBy: 'Current session', lines, journalType: header.data.journalType,
    },
  }
}
