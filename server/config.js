import { resolve } from 'node:path'

const port = Number(process.env.JOYNO_API_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('JOYNO_API_PORT must be a valid TCP port.')
const databaseDriver = process.env.JOYNO_DB_DRIVER || 'sqlite'
if (!['sqlite', 'postgres'].includes(databaseDriver)) throw new Error('JOYNO_DB_DRIVER must be sqlite or postgres.')
const production = process.env.NODE_ENV === 'production'
if (production && databaseDriver !== 'postgres') throw new Error('Production requires JOYNO_DB_DRIVER=postgres.')
const databasePort = Number(process.env.JOYNO_DB_PORT || 5432)
if (!Number.isInteger(databasePort) || databasePort < 1 || databasePort > 65535) throw new Error('JOYNO_DB_PORT must be a valid TCP port.')
const proxy = process.env.JOYNO_TRUST_PROXY || ''

export const config = {
  port,
  production,
  host: process.env.JOYNO_API_HOST || '127.0.0.1',
  trustProxy: proxy === '1' ? 1 : proxy || false,
  databaseDriver,
  databaseUrl: process.env.JOYNO_DATABASE_URL,
  databaseHost: process.env.JOYNO_DB_HOST || '127.0.0.1',
  databasePort,
  databaseName: process.env.JOYNO_DB_NAME || 'joyno',
  databaseUser: process.env.JOYNO_DB_USER,
  databasePassword: process.env.JOYNO_DB_PASSWORD,
  databaseSsl: process.env.JOYNO_DATABASE_SSL === 'true',
  databaseCaPath: process.env.JOYNO_DATABASE_CA,
  databasePath: process.env.JOYNO_DB_PATH || resolve('server/data/joyno.sqlite'),
  allowedOrigins: (process.env.JOYNO_CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  sessionHours: 12,
}
