import { randomUUID } from 'node:crypto'
const map = (row) => row && ({ ...JSON.parse(row.payload), id: row.id, version: row.version })
export function jsonRecordRepository(db, kind) {
  const get = async (companyId, id) => map((await db.query('SELECT * FROM company_records WHERE company_id = $1 AND kind = $2 AND id = $3', [companyId, kind, id])).rows[0])
  return {
    get,
    async all(companyId) {
      return (await db.query('SELECT * FROM company_records WHERE company_id = $1 AND kind = $2 ORDER BY id', [companyId, kind])).rows.map(map)
    },
    async save(companyId, id, value) {
      const target = id || randomUUID()
      if (id) await db.query('UPDATE company_records SET payload = $4, version = version + 1 WHERE company_id = $1 AND kind = $2 AND id = $3', [companyId, kind, target, JSON.stringify(value)])
      else await db.query('INSERT INTO company_records (id, company_id, kind, payload) VALUES ($1, $2, $3, $4)', [target, companyId, kind, JSON.stringify(value)])
      return get(companyId, target)
    },
    remove: (companyId, id) => db.query('DELETE FROM company_records WHERE company_id = $1 AND kind = $2 AND id = $3', [companyId, kind, id]),
  }
}
