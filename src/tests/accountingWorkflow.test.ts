import { beforeEach, describe, expect, it } from 'vitest'
import { createPostedJournal, generatedJournals, transitionJournalEntry, workflowAuditEvents } from '../features/accounting/workflows/accountingWorkflow'
import type { JournalPreviewEntry } from '../features/accounting/journals/journalPreviewData'

const input = { kind: 'general-journal' as const, sourceKey: 'test:1', referenceNumber: 'TEST-1', date: '2026-09-30', party: '', remarks: '', lines: [{ accountId: '101', debitCents: 500, creditCents: 0 }, { accountId: '201', debitCents: 0, creditCents: 500 }] }

beforeEach(() => { generatedJournals.value = []; workflowAuditEvents.value = [] })

describe('accounting workflows', () => {
  it('requires balanced journals', () => {
    expect(() => createPostedJournal({ ...input, lines: [{ accountId: '101', debitCents: 500, creditCents: 0 }, { accountId: '201', debitCents: 0, creditCents: 400 }] })).toThrow(/balanced/)
  })
  it('prevents duplicate journal creation and records audit events', () => {
    expect(createPostedJournal(input).created).toBe(true)
    expect(createPostedJournal(input).created).toBe(false)
    expect(generatedJournals.value).toHaveLength(1)
    expect(workflowAuditEvents.value.map((event) => event.action)).toEqual(['posted', 'created'])
  })
  it('posts drafts and voids posted entries without replacing the original object', () => {
    const draft = { ...createPostedJournal(input).entry, status: 'Draft' } as JournalPreviewEntry
    const posted = transitionJournalEntry(draft, 'post')
    const voided = transitionJournalEntry(posted, 'void')
    expect(draft.status).toBe('Draft')
    expect(voided.status).toBe('Voided')
  })
})
