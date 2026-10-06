import { ApiFailure } from '../../http/errors.js'
import { z } from 'zod'
import { appendAudit } from './accountRepository.js'
import { versionSchema } from './accountSchemas.js'
import { journalListSchema, journalSchema } from './journalSchemas.js'
import { journalRepository } from './journalRepository.js'

const invalid = (message) => new ApiFailure('VALIDATION_ERROR', 422, message)
const state = (message) => new ApiFailure('INVALID_STATE_TRANSITION', 409, message)
export async function assertOpenPeriod(db, companyId, date) {
  const row = (await db.query("SELECT payload FROM company_settings WHERE company_id = $1 AND kind = 'recording'", [companyId])).rows[0]
  const closing = row ? JSON.parse(row.payload) : {}
  if (closing.closeYear && closing.closeMonth && date.slice(0, 7) <= `${closing.closeYear}-${closing.closeMonth.padStart(2, '0')}`) throw state('This accounting period is closed. Use an entry in an open period.')
}
export async function validateJournal(db, companyId, entry) {
  let debit = 0
  let credit = 0
  for (const line of entry.lines) {
    if ((line.debitCents > 0) === (line.creditCents > 0)) throw invalid('Each line must contain either a debit or a credit.')
    const account = (await db.query('SELECT id FROM accounts WHERE company_id = $1 AND id = $2 AND active = 1', [companyId, line.accountId])).rows[0]
    if (!account) throw invalid('Choose active accounts from this company for every line.')
    debit += line.debitCents; credit += line.creditCents
  }
  if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit) || debit <= 0 || debit !== credit) throw invalid('Debits and credits must be positive and balanced.')
  await assertOpenPeriod(db, companyId, entry.date)
}
export function journalService(db) {
  const repository = journalRepository(db)
  async function requireRecord(tx, companyId, id, version) {
    const record = await journalRepository(tx).get(companyId, id)
    if (!record) throw new ApiFailure('NOT_FOUND', 404, 'Journal entry not found.')
    if (version !== undefined && record.version !== versionSchema.parse(version)) throw new ApiFailure('CONFLICT', 409, 'This journal changed. Reload before continuing.')
    return record
  }
  async function changeStatus(tx, context, id, version, action) {
    const previous = await requireRecord(tx, context.companyId, id, version)
    if (previous.sourceKey && action === 'void') throw state('Void the source transaction so its record and journal stay consistent.')
    const from = action === 'post' ? 'Draft' : 'Posted'
    const to = action === 'post' ? 'Posted' : 'Voided'
    if (previous.status !== from) throw state(`Only ${from.toLowerCase()} entries can be ${action === 'post' ? 'posted' : 'voided'}.`)
    if (action === 'post') await validateJournal(tx, context.companyId, previous)
    else await assertOpenPeriod(tx, context.companyId, previous.date)
    await tx.query(`UPDATE journal_entries SET status = $3, ${action === 'post' ? 'posted_at' : 'voided_at'} = $4, version = version + 1 WHERE company_id = $1 AND id = $2`, [context.companyId, id, to, new Date().toISOString()])
    const saved = await journalRepository(tx).get(context.companyId, id)
    await appendAudit(tx, context, to, 'journal-entries', id, previous, saved)
    return saved
  }
  return {
    list: (companyId, query) => repository.list(companyId, journalListSchema.parse(query)),
    get: (companyId, id) => requireRecord(db, companyId, id),
    async save(context, id, body) {
      const { expectedVersion, ...input } = body
      const value = journalSchema.parse(input)
      if (id) versionSchema.parse(expectedVersion)
      if (value.kind !== 'general-journal' || value.status !== 'Draft' || value.sourceKey) throw invalid('Source journals and posted entries cannot be edited here.')
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const previous = id ? await requireRecord(tx, context.companyId, id, expectedVersion) : null
        if (previous && (previous.status !== 'Draft' || previous.kind !== 'general-journal' || previous.sourceKey)) throw state('Posted and source entries are read-only. Use a reversal or void operation.')
        await validateJournal(tx, context.companyId, value)
        const scoped = journalRepository(tx)
        const target = id || await scoped.create(context, value)
        if (id) await scoped.update(context.companyId, id, value)
        const saved = await scoped.get(context.companyId, target)
        await appendAudit(tx, context, previous ? 'Updated' : 'Created', 'journal-entries', target, previous, saved)
        return saved
      })
    },
    async transition(context, id, body, action) {
      const { expectedVersion: version } = z.object({ expectedVersion: versionSchema }).strict().parse(body)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        return changeStatus(tx, context, id, version, action)
      })
    },
    async transitionBatch(context, body) {
      const input = z.object({ action: z.enum(['post', 'void']), entries: z.array(z.object({ id: z.string().min(1), expectedVersion: versionSchema }).strict()).min(1).max(200) }).strict().parse(body)
      if (new Set(input.entries.map((entry) => entry.id)).size !== input.entries.length) throw invalid('The selection contains duplicate entries.')
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const saved = []
        for (const entry of input.entries) saved.push(await changeStatus(tx, context, entry.id, entry.expectedVersion, input.action))
        return saved
      })
    },
    async remove(context, id, version) {
      versionSchema.parse(version)
      return db.transaction(async (tx) => {
        await tx.lockCompany(context.companyId)
        const previous = await requireRecord(tx, context.companyId, id, version)
        if (previous.status !== 'Draft') throw state('Posted or voided entries cannot be deleted.')
        await assertOpenPeriod(tx, context.companyId, previous.date)
        await tx.query('DELETE FROM journal_lines WHERE company_id = $1 AND journal_entry_id = $2', [context.companyId, id])
        await tx.query('DELETE FROM journal_entries WHERE company_id = $1 AND id = $2', [context.companyId, id])
        await appendAudit(tx, context, 'Deleted', 'journal-entries', id, previous, null)
      })
    },
  }
}
