// Only for the preserved pre-documents rollback image, never the new API release.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const migrations = [{ version: 1, file: '001_foundation.sql', directory: 'postgresMigrations' },
  { version: 2, file: '002_company.sql', directory: 'migrations' },
  { version: 3, file: '003_journals.sql', directory: 'migrations' },
  { version: 4, file: '004_documents.sql', directory: 'migrations' }].map((migration) => {
  const sql = readFileSync(new URL(`./${migration.directory}/${migration.file}`, import.meta.url), 'utf8')
  return { ...migration, checksum: createHash('sha256').update(sql).digest('hex') }
})
export async function requirePostgresSchema(db) {
  const { rows } = await db.query('SELECT version, checksum FROM schema_migrations ORDER BY version')
  if (![3, 4].includes(rows.length) || rows.some((row, index) => row.version !== migrations[index].version || row.checksum !== migrations[index].checksum)) {
    throw new Error('Rollback image only supports verified schema versions 3 or 4.')
  }
}
export async function migratePostgres() {
  throw new Error('Rollback images must not run migrations. Use the new release migration job.')
}
