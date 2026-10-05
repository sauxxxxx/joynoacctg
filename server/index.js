import { createApp } from './app.js'
import { config } from './config.js'
import { openDatabase } from './db/connection.js'

const db = openDatabase()
const server = createApp(db).listen(config.port, '127.0.0.1', () => {
  console.log(`Joyno local API: http://localhost:${config.port}/api/v1/health`)
})
server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Set JOYNO_API_PORT to another port.` : error.message)
  db.close()
  process.exitCode = 1
})
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => server.close(() => { db.close(); process.exit(0) }))
}
