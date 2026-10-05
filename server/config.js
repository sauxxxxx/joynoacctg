import { resolve } from 'node:path'

const port = Number(process.env.JOYNO_API_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('JOYNO_API_PORT must be a valid TCP port.')

export const config = {
  port,
  databasePath: process.env.JOYNO_DB_PATH || resolve('server/data/joyno.sqlite'),
  allowedOrigins: (process.env.JOYNO_CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',').map((origin) => origin.trim()).filter(Boolean),
  sessionHours: 12,
}
