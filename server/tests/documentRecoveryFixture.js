// Called only by verify-file-recovery.sh against newly created disposable databases.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { config } from '../config.js'
import { openPostgres } from '../db/postgresConnection.js'
import { bootstrapAdministrator } from '../features/auth/bootstrapService.js'
import { privateDocumentService } from '../features/documents/documentService.js'

if (!/^joyno_filesverify_[0-9a-f]{32}$/.test(config.databaseName)) throw new Error('Disposable recovery database required.')
const db = openPostgres(config)
try {
  const bytes = Buffer.from('%PDF-1.7\nDisposable file recovery verification\n%%EOF')
  const service = privateDocumentService(db)
  if (process.argv[2] === 'seed') {
    const { companyId, userId } = await bootstrapAdministrator(db, { username: 'restore-test', password: randomBytes(32).toString('hex'), companyName: 'Disposable file recovery' })
    const header = Buffer.from(JSON.stringify({ name: 'File recovery fixture', fileName: 'fixture.pdf', category: 'Other', size: bytes.length })).toString('base64')
    await service.upload({ companyId, userId, requestId: 'file-recovery-test' }, header, bytes)
  } else if (process.argv[2] !== 'verify') throw new Error('Use seed or verify.')
  const rows = (await db.query("SELECT id, company_id FROM company_records WHERE kind = 'documents'")).rows
  assert.equal(rows.length, 1)
  assert.deepEqual((await service.content(rows[0].company_id, rows[0].id)).bytes, bytes)
  console.log('Private document metadata, contents and checksum verified.')
} finally { await db.close() }
