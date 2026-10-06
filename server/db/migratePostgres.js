import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'

const migrations = [{ version: 1, file: '001_foundation.sql', directory: 'postgresMigrations' },
  { version: 2, file: '002_company.sql', directory: 'migrations' },
  { version: 3, file: '003_journals.sql', directory: 'migrations' },
  { version: 4, file: '004_documents.sql', directory: 'migrations' }].map((migration) => {
  const sql = readFileSync(new URL(`./${migration.directory}/${migration.file}`, import.meta.url), 'utf8')
  return { ...migration, sql, checksum: createHash('sha256').update(sql).digest('hex') }
})

export async function migratePostgres(db) {
  return db.transaction(async (tx) => {
    await tx.query('SELECT pg_advisory_xact_lock(178956970, 1)')
    await tx.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY, checksum TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`)
    for (const migration of migrations) {
      const { rows } = await tx.query('SELECT checksum FROM schema_migrations WHERE version = $1', [migration.version])
      if (rows.length) {
        if (rows[0].checksum !== migration.checksum) throw new Error(`Migration ${migration.version} changed after application. Restore it and add a new migration.`)
        continue
      }
      await tx.query(migration.sql)
      await tx.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [migration.version, migration.checksum])
    }
  })
}

export async function requirePostgresSchema(db) {
  const { rows } = await db.query('SELECT version, checksum FROM schema_migrations ORDER BY version')
  if (rows.length !== migrations.length || migrations.some((migration, index) =>
    rows[index]?.version !== migration.version || rows[index]?.checksum !== migration.checksum)) {
    throw new Error('PostgreSQL schema does not match this release. Run api:migrate before starting the API.')
  }
}
