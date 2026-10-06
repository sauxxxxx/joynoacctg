import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { config } from '../config.js'
import { openBackend } from '../db/backend.js'

if (config.databaseDriver !== 'postgres') throw new Error('Verification requires PostgreSQL owner credentials.')
const name = `joyno_verify_${randomUUID().replaceAll('-', '')}`
const connection = config.databaseUrl ? new URL(config.databaseUrl) : new URL('postgresql://localhost')
if (!config.databaseUrl) {
  connection.hostname = config.databaseHost
  connection.port = String(config.databasePort)
  connection.username = config.databaseUser
  connection.password = config.databasePassword
}
connection.pathname = `/${name}`
const db = await openBackend()
let created = false
try {
  await db.query(`CREATE DATABASE "${name}"`)
  created = true
  const result = spawnSync(process.execPath, ['--test', fileURLToPath(new URL('../tests/postgres.live.test.js', import.meta.url))], {
    stdio: 'inherit', env: { ...process.env, JOYNO_TEST_DATABASE_URL: connection.href },
  })
  process.exitCode = result.status ?? 1
} finally {
  try {
    if (created && /^joyno_verify_[0-9a-f]{32}$/.test(name)) await db.query(`DROP DATABASE "${name}"`)
  } finally { await db.close() }
}
