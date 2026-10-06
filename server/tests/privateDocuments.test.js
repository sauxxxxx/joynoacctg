import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { httpFixture } from './httpFixture.js'
import { privateDocumentService } from '../features/documents/documentService.js'

for (const dialect of ['postgres', 'sqlite']) test(`${dialect}: private uploads enforce size/type/tenant access, checksum integrity, atomic audit and recoverable archives`, async (t) => {
  const api = await httpFixture(t, dialect)
  const bytes = Buffer.from('%PDF-1.7\nDisposable fixture\n%%EOF')
  const metadata = { name: 'Receipt', fileName: 'receipt.pdf', size: bytes.length, category: 'Receipt', reference: '', notes: '' }
  const header = Buffer.from(JSON.stringify(metadata)).toString('base64')
  async function upload(content, properties = metadata, token = api.token) {
    const response = await fetch(api.base + api.root + '/documents', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'X-Document-Metadata': Buffer.from(JSON.stringify(properties)).toString('base64'), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: content })
    return { status: response.status, body: await response.json() }
  }
  assert.equal((await upload(bytes, metadata, '')).status, 401)
  assert.equal((await upload(Buffer.from('<html>not a PDF</html>'))).status, 422)
  assert.equal((await upload(bytes, { ...metadata, fileName: 'receipt.svg' })).status, 422)
  assert.equal((await upload(bytes, { ...metadata, fileName: '../receipt.pdf' })).status, 422)
  assert.equal((await upload(bytes, { ...metadata, size: 1 })).status, 422)
  const context = { companyId: api.companyId, userId: api.userId, requestId: 'document-upload-test' }
  const failing = { ...api.db, transaction: (operation) => api.db.transaction((tx) => operation({ ...tx, query(sql, values) { if (sql.includes('INSERT INTO audit_events')) throw new Error('Deliberate upload audit failure'); return tx.query(sql, values) } })) }
  await assert.rejects(privateDocumentService(failing).upload(context, header, bytes), /Deliberate upload audit failure/)
  assert.equal((await api.request(api.root + '/documents')).body.total, 0)
  assert.equal(Number((await api.db.query('SELECT COUNT(*) AS count FROM document_contents')).rows[0].count), 0)
  const result = await upload(bytes)
  assert.equal(result.status, 201, JSON.stringify(result.body))
  const record = result.body.data
  assert.equal(record.version, 1)
  assert.equal(record.url, undefined)
  assert.equal(record.content_base64, undefined)
  const response = await fetch(api.base + api.root + `/documents/${record.id}/content`, { headers: { Authorization: `Bearer ${api.token}` } })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Content-Disposition'), /^attachment;/)
  assert.equal(response.headers.get('X-Content-Type-Options'), 'nosniff')
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes)
  assert.equal((await api.request(`/companies/${randomUUID()}/documents/${record.id}/content`)).status, 404)
  assert.equal((await api.request(`${api.root}/documents/${record.id}?expectedVersion=9`, 'DELETE')).status, 409)
  assert.equal((await api.request(`${api.root}/documents/${record.id}?expectedVersion=1`, 'DELETE')).status, 204)
  assert.equal((await api.request(api.root + '/documents')).body.total, 0)
  assert.equal((await api.request(api.root + '/documents?archived=true')).body.total, 1)
  assert.equal((await api.request(`${api.root}/documents/${record.id}/restore`, 'POST', { expectedVersion: 2 })).status, 200)
  assert.equal((await api.request(api.root + '/documents')).body.data[0].version, 3)
  await api.db.query('UPDATE document_contents SET content_base64 = $3 WHERE company_id = $1 AND document_id = $2', [api.companyId, record.id, Buffer.from('corrupt').toString('base64')])
  assert.equal((await api.request(`${api.root}/documents/${record.id}/content`)).status, 500)
})
