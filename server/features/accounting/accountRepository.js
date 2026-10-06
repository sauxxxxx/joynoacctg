import { randomUUID } from 'node:crypto'

const definitions = {
  accounts: { table: 'accounts', fields: { code: 'code', name: 'name', parentCode: 'parent_code', type: 'type', remarks: 'remarks', active: 'active', itr: 'itr', legalBasis: 'legal_basis' } },
  categories: { table: 'account_categories', fields: { code: 'code', name: 'name', parentCode: 'parent_code', remarks: 'remarks', active: 'active', accountType: 'account_type' } },
}
const placeholders = (count) => Array.from({ length: count }, (_, index) => `$${index + 1}`)

export function accountRepository(db, kind) {
  const { table, fields } = definitions[kind]
  const pairs = Object.entries(fields)
  const map = (row) => row && ({ id: row.id, version: row.version,
    ...Object.fromEntries(pairs.map(([key, column]) => [key, key === 'active' ? Boolean(row[column]) : row[column] ?? undefined])),
  })
  const values = (record) => pairs.map(([key]) => key === 'active' ? Number(record.active) : record[key] ?? null)
  const first = async (sql, parameters) => map((await db.query(sql, parameters)).rows[0])
  const get = (companyId, id) => first(`SELECT * FROM ${table} WHERE company_id = $1 AND id = $2`, [companyId, id])

  return {
    get,
    byCode: (companyId, code) => first(`SELECT * FROM ${table} WHERE company_id = $1 AND code = $2`, [companyId, code]),
    async children(companyId, parentCode) {
      return (await db.query(`SELECT id FROM ${table} WHERE company_id = $1 AND parent_code = $2`, [companyId, parentCode])).rows
    },
    async list(companyId, query) {
      const clauses = ['company_id = $1']
      const bindings = [companyId]
      if (query.search) {
        bindings.push(`%${query.search.toLowerCase().replace(/[\\%_]/g, '\\$&')}%`)
        const position = `$${bindings.length}`
        clauses.push(`(lower(code) LIKE ${position} ESCAPE '\\' OR lower(name) LIKE ${position} ESCAPE '\\')`)
      }
      if (query.active !== undefined) {
        bindings.push(Number(query.active === 'true'))
        clauses.push(`active = $${bindings.length}`)
      }
      const where = clauses.join(' AND ')
      const total = Number((await db.query(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`, bindings)).rows[0].count)
      const column = fields[query.sortBy]
      const direction = query.sortDirection === 'desc' ? 'DESC' : 'ASC'
      const { rows } = await db.query(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${column} ${direction}, id ASC
        LIMIT $${bindings.length + 1} OFFSET $${bindings.length + 2}`,
      [...bindings, query.pageSize, (query.page - 1) * query.pageSize])
      return { data: rows.map(map), page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) }
    },
    create(companyId, record) {
      const id = randomUUID()
      const columns = pairs.map(([, column]) => column)
      return first(`INSERT INTO ${table} (id, company_id, ${columns.join(', ')})
        VALUES (${placeholders(columns.length + 2).join(', ')}) RETURNING *`, [id, companyId, ...values(record)])
    },
    update(companyId, id, record, expectedVersion) {
      const assignments = pairs.map(([, column], index) => `${column} = $${index + 1}`)
      const offset = pairs.length
      return first(`UPDATE ${table} SET ${assignments.join(', ')}, version = version + 1
        WHERE company_id = $${offset + 1} AND id = $${offset + 2} AND version = $${offset + 3} RETURNING *`,
      [...values(record), companyId, id, expectedVersion])
    },
    async remove(companyId, id, expectedVersion) {
      return (await db.query(`DELETE FROM ${table} WHERE company_id = $1 AND id = $2 AND version = $3`,
        [companyId, id, expectedVersion])).rowCount
    },
  }
}

export async function appendAudit(db, context, action, kind, id, before, after) {
  await db.query(`INSERT INTO audit_events (id, company_id, actor_user_id, action, entity_type, entity_id, before_json, after_json, request_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
  [randomUUID(), context.companyId, context.userId, action, kind, id,
    before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null, context.requestId, new Date().toISOString()])
}
