import { readFileSync } from 'node:fs'
import pg from 'pg'
import { postgresAdapter } from './postgresAdapter.js'

export function openPostgres(settings) {
  if (!settings.databaseUrl && (!settings.databaseUser || !settings.databasePassword)) {
    throw new Error('Set JOYNO_DATABASE_URL or JOYNO_DB_USER and JOYNO_DB_PASSWORD for PostgreSQL.')
  }
  const ssl = settings.databaseCaPath
    ? { ca: readFileSync(settings.databaseCaPath, 'utf8'), rejectUnauthorized: true }
    : settings.databaseSsl ? { rejectUnauthorized: true } : false
  const pool = new pg.Pool({
    ...(settings.databaseUrl ? { connectionString: settings.databaseUrl } : {
      host: settings.databaseHost, port: settings.databasePort, database: settings.databaseName,
      user: settings.databaseUser, password: settings.databasePassword,
    }),
    ssl, max: 10,
    connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000,
    statement_timeout: 15_000, application_name: 'joyno-accounting',
  })
  pool.on('error', () => console.error('An idle PostgreSQL connection failed. Check database availability.'))
  return postgresAdapter(pool)
}
