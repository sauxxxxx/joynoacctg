// Disposable PostgreSQL-engine fixture for manual browser verification. Never opens production data.
import { once } from 'node:events'
import { createApp } from '../app.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { postgresFixture } from './postgresFixture.js'

let closeDatabase
const db = await postgresFixture({ after: (close) => { closeDatabase = close } })
await bootstrapAdministrator(db, {
  username: 'browser-test', password: 'disposable-browser-test-123', companyName: 'Disposable browser test',
})
const server = createApp(db).listen(3003, '127.0.0.1')
await once(server, 'listening')
console.log('Disposable PostgreSQL engine fixture: http://127.0.0.1:3003. All test records disappear when stopped.')
async function stop() {
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  await closeDatabase()
}
process.once('SIGINT', () => { void stop() })
process.once('SIGTERM', () => { void stop() })
