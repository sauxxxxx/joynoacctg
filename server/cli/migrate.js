import { config } from '../config.js'
import { openBackend } from '../db/backend.js'
import { migratePostgres } from '../db/migratePostgres.js'
import { grantRuntime } from '../db/grantRuntime.js'

if (config.databaseDriver !== 'postgres') {
  console.error('Set JOYNO_DB_DRIVER=postgres before running api:migrate. SQLite migrations run automatically.')
  process.exitCode = 1
} else {
  const db = await openBackend()
  try {
    await migratePostgres(db)
    if (process.env.JOYNO_DB_RUNTIME_ROLE) await grantRuntime(db, process.env.JOYNO_DB_RUNTIME_ROLE)
    console.log('PostgreSQL migrations applied successfully.')
  } catch (error) {
    console.error(error.code ? `PostgreSQL migration failed (${error.code}). Check connectivity and database logs.` : error.message)
    process.exitCode = 1
  } finally { await db.close() }
}
