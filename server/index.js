import { createApp } from './app.js'
import { config } from './config.js'
import { openBackend } from './db/backend.js'
import { requirePostgresSchema } from './db/migratePostgres.js'

let db
try {
  db = await openBackend()
  if (db.dialect === 'postgres') await requirePostgresSchema(db)
  const server = createApp(db).listen(config.port, config.host, () => {
    console.log(`Joyno API (${db.dialect}): http://${config.host}:${config.port}/api/v1/health`)
  })
  server.on('error', async (error) => {
    console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Set JOYNO_API_PORT to another port.` : 'API listener failed.')
    await db.close()
    process.exitCode = 1
  })
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.once(signal, () => {
      setTimeout(() => process.exit(1), 15_000).unref()
      server.close(async () => { await db.close(); process.exit(0) })
    })
  }
} catch (error) {
  console.error(error.code ? `Database startup failed (${error.code}). Check connectivity and run api:migrate for PostgreSQL.` : error.message)
  if (db) await db.close()
  process.exitCode = 1
}
