import { PGlite } from '@electric-sql/pglite'
import { migratePostgres } from '../db/migratePostgres.js'

// Real PostgreSQL SQL engine in WASM, not a substitute for VPS network/pool verification.
export async function postgresFixture(t) {
  const engine = await PGlite.create()
  const scope = (connection) => ({
    dialect: 'postgres',
    async query(sql, parameters) {
      const result = parameters
        ? await connection.query(sql, parameters)
        : (await connection.exec(sql)).at(-1)
      return { ...result, rowCount: result.affectedRows, rows: result.rows || [] }
    },
    lockCompany: (id) => connection.query('SELECT id FROM companies WHERE id = $1 FOR UPDATE', [id]),
  })
  const db = { ...scope(engine), transaction: (operation) => engine.transaction((tx) => operation(scope(tx))) }
  t.after(() => engine.close())
  await migratePostgres(db)
  return db
}
