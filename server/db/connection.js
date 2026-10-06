import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { config } from '../config.js'

const migrations = ['001_foundation.sql', '002_company.sql', '003_journals.sql', '004_documents.sql'].map((file, index) => ({
  version: index + 1, sql: readFileSync(new URL(`./migrations/${file}`, import.meta.url), 'utf8'),
}))

export function openDatabase(path = config.databasePath) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL')
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)')
  for (const migration of migrations) {
    if (db.prepare('SELECT version FROM schema_migrations WHERE version = ?').get(migration.version)) continue
    db.exec('BEGIN IMMEDIATE')
    try {
      db.exec(migration.sql)
      db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)').run(migration.version, new Date().toISOString())
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      db.close()
      throw error
    }
  }
  return db
}
