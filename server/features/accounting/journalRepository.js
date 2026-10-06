import { randomUUID } from 'node:crypto'
export function journalRepository(db) {
  async function map(row) {
    if (!row) return null
    const lines = (await db.query('SELECT * FROM journal_lines WHERE company_id = $1 AND journal_entry_id = $2 ORDER BY position', [row.company_id, row.id])).rows.map((line) => ({
      accountId: line.account_id, debitCents: Number(line.debit_cents), creditCents: Number(line.credit_cents), subsidiary: line.subsidiary, remarks: line.remarks,
    }))
    return { id: row.id, version: row.version, kind: row.kind, journalNumber: String(row.journal_number), referenceNumber: row.reference_number,
      date: row.entry_date, party: row.party, remarks: row.remarks, journalType: row.journal_type || undefined, sourceKey: row.source_key || undefined,
      status: row.status, createdBy: row.actor_name, amountCents: lines.reduce((sum, line) => sum + line.debitCents, 0), lines }
  }
  const select = `SELECT j.*, u.name AS actor_name FROM journal_entries j JOIN users u ON u.id = j.created_by WHERE j.company_id = $1`
  async function writeLines(companyId, id, lines) {
    for (const [position, line] of lines.entries()) await db.query(`INSERT INTO journal_lines
      (id, company_id, journal_entry_id, account_id, position, debit_cents, credit_cents, subsidiary, remarks) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [randomUUID(), companyId, id, line.accountId, position, line.debitCents, line.creditCents, line.subsidiary || '', line.remarks || ''])
  }
  return {
    get: async (companyId, id) => map((await db.query(select + ' AND j.id = $2', [companyId, id])).rows[0]),
    source: async (companyId, sourceKey) => map((await db.query(select + ' AND j.source_key = $2', [companyId, sourceKey])).rows[0]),
    async list(companyId, query) {
      const values = [companyId]
      const clauses = []
      for (const [key, column, operator] of [['kind', 'kind', '='], ['status', 'status', '='], ['from', 'entry_date', '>='], ['to', 'entry_date', '<=']]) {
        if (!query[key]) continue
        values.push(query[key]); clauses.push(`j.${column} ${operator} $${values.length}`)
      }
      if (query.search) {
        values.push(`%${query.search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
        clauses.push(`lower(CAST(j.journal_number AS TEXT) || ' ' || j.reference_number || ' ' || j.party || ' ' || j.remarks) LIKE $${values.length} ESCAPE '\\'`)
      }
      const where = clauses.length ? ' AND ' + clauses.join(' AND ') : ''
      const { page, pageSize } = query
      const total = Number((await db.query('SELECT COUNT(*) AS count FROM journal_entries j WHERE j.company_id = $1' + where, values)).rows[0].count)
      const column = query.sortBy === 'journalNumber' ? 'journal_number' : 'entry_date'
      const direction = query.sortDirection === 'asc' ? 'ASC' : 'DESC'
      const rows = (await db.query(select + where + ` ORDER BY j.${column} ${direction}, j.id LIMIT $${values.length + 1} OFFSET $${values.length + 2}`, [...values, pageSize, (page - 1) * pageSize])).rows
      return { data: await Promise.all(rows.map(map)), page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    },
    async create(context, record) {
      const id = randomUUID()
      const number = Number((await db.query('SELECT COALESCE(MAX(journal_number), 0) AS number FROM journal_entries WHERE company_id = $1 AND kind = $2', [context.companyId, record.kind])).rows[0].number) + 1
      await db.query(`INSERT INTO journal_entries (id, company_id, kind, journal_number, entry_date, reference_number, party, remarks, journal_type, source_key, status, created_by, posted_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, context.companyId, record.kind, number, record.date, record.referenceNumber, record.party, record.remarks, record.journalType || null, record.sourceKey || null, record.status, context.userId, record.status === 'Posted' ? new Date().toISOString() : null])
      await writeLines(context.companyId, id, record.lines)
      return id
    },
    async update(companyId, id, record) {
      await db.query('UPDATE journal_entries SET entry_date = $3, reference_number = $4, party = $5, remarks = $6, journal_type = $7, version = version + 1 WHERE company_id = $1 AND id = $2',
        [companyId, id, record.date, record.referenceNumber, record.party, record.remarks, record.journalType || null])
      await db.query('DELETE FROM journal_lines WHERE company_id = $1 AND journal_entry_id = $2', [companyId, id])
      await writeLines(companyId, id, record.lines)
    },
  }
}
