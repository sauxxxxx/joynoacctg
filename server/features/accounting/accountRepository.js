import { randomUUID } from 'node:crypto'

const definitions = {
  accounts: { table: 'accounts', fields: { code: 'code', name: 'name', parentCode: 'parent_code', type: 'type', remarks: 'remarks', active: 'active', itr: 'itr', legalBasis: 'legal_basis' } },
  categories: { table: 'account_categories', fields: { code: 'code', name: 'name', parentCode: 'parent_code', remarks: 'remarks', active: 'active', accountType: 'account_type' } },
}

export function accountRepository(db, kind) {
  const { table, fields } = definitions[kind]
  const pairs = Object.entries(fields)
  const map = (row) => row && ({ id: row.id, version: row.version,
    ...Object.fromEntries(pairs.map(([key, column]) => [key, key === 'active' ? Boolean(row[column]) : row[column] ?? undefined])),
  })
  const values = (record) => pairs.map(([key]) => key === 'active' ? Number(record.active) : record[key] ?? null)
  const get = (companyId, id) => map(db.prepare(`SELECT * FROM ${table} WHERE company_id = ? AND id = ?`).get(companyId, id))

  return {
    get,
    byCode(companyId, code) { return map(db.prepare(`SELECT * FROM ${table} WHERE company_id = ? AND code = ?`).get(companyId, code)) },
    children(companyId, parentCode) { return db.prepare(`SELECT id FROM ${table} WHERE company_id = ? AND parent_code = ?`).all(companyId, parentCode) },
    list(companyId, query) {
      const clauses = ['company_id = ?']
      const bindings = [companyId]
      if (query.search) {
        const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`
        clauses.push("(code LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')")
        bindings.push(pattern, pattern)
      }
      if (query.active !== undefined) { clauses.push('active = ?'); bindings.push(Number(query.active === 'true')) }
      const where = clauses.join(' AND ')
      const total = db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get(...bindings).count
      const column = fields[query.sortBy]
      const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC'
      const rows = db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${column} ${direction}, id ASC LIMIT ? OFFSET ?`)
        .all(...bindings, query.pageSize, (query.page - 1) * query.pageSize)
      return { data: rows.map(map), page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) }
    },
    create(companyId, record) {
      const id = randomUUID()
      const columns = pairs.map(([, column]) => column)
      db.prepare(`INSERT INTO ${table} (id, company_id, ${columns.join(', ')}) VALUES (${Array(columns.length + 2).fill('?').join(', ')})`)
        .run(id, companyId, ...values(record))
      return get(companyId, id)
    },
    update(companyId, id, record, expectedVersion) {
      const result = db.prepare(`UPDATE ${table} SET ${pairs.map(([, column]) => `${column} = ?`).join(', ')}, version = version + 1 WHERE company_id = ? AND id = ? AND version = ?`)
        .run(...values(record), companyId, id, expectedVersion)
      return result.changes ? get(companyId, id) : null
    },
    remove(companyId, id, expectedVersion) {
      return db.prepare(`DELETE FROM ${table} WHERE company_id = ? AND id = ? AND version = ?`).run(companyId, id, expectedVersion).changes
    },
  }
}

export function appendAudit(db, context, action, kind, id, before, after) {
  db.prepare(`INSERT INTO audit_events (id, company_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(randomUUID(), context.companyId, context.userId, action, kind, id,
      before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, context.requestId, new Date().toISOString())
}
