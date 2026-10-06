import { openBackend } from '../db/backend.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'

const username = process.env.JOYNO_ADMIN_USERNAME?.trim()
const password = process.env.JOYNO_ADMIN_PASSWORD ?? ''
const companyName = process.env.JOYNO_COMPANY_NAME?.trim()
if (!username || username.length > 254 || !companyName || companyName.length > 120 || password.length < 12 || password.length > 128) {
  console.error('Set JOYNO_ADMIN_USERNAME (1–254 characters), JOYNO_ADMIN_PASSWORD (12–128 characters), and JOYNO_COMPANY_NAME (1–120 characters) before running api:bootstrap.')
  process.exitCode = 1
} else {
  const db = await openBackend()
  try {
    const { companyId } = await bootstrapAdministrator(db, { username, password, companyName })
    console.log(`Company created: ${companyName} (${companyId}). Admin username: ${username}.`)
  } catch (error) {
    console.error(error.code ? `Bootstrap failed (${error.code}). Check migrations and database connectivity.` : error.message)
    process.exitCode = 1
  } finally { await db.close() }
}
