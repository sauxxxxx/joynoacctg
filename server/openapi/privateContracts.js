import { z } from 'zod'
import { profileSchema, passwordSchema } from '../features/auth/selfService.js'

const json = (schema) => ({ 'application/json': { schema } })
const envelope = (schema) => ({ type: 'object', required: ['data', 'requestId'], properties: { data: schema, requestId: { type: 'string' } } })
const failures = Object.fromEntries([401, 403, 404, 409, 413, 422, 429].map((code) => [code, { description: 'Structured error', content: json({ $ref: '#/components/schemas/Error' }) }]))
const version = { type: 'integer', minimum: 1 }
const company = { name: 'companyId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
const id = { name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
const profile = { type: 'object', properties: { id: { type: 'string' }, username: { type: 'string' }, name: { type: 'string' }, email: { type: 'string' }, version } }
const record = { type: 'object', properties: { ...Object.fromEntries(['id', 'name', 'fileName', 'mimeType', 'category', 'reference', 'notes', 'uploadedAt', 'sha256'].map((key) => [key, { type: 'string' }])), version, size: { type: 'integer' }, archived: { type: 'boolean' } } }
const body = (schema) => ({ required: true, content: json(schema) })
function schemaOf(schema) { const { $schema: _dialect, ...value } = z.toJSONSchema(schema, { io: 'input' }); return value }
const changes = (summary, schema) => ({ tags: ['Account'], summary, description: 'Authenticated self-service only. Verifies the current password and expectedVersion, audits without secrets, and revokes all sessions atomically. Sign in again after success.', requestBody: body(schemaOf(schema)), responses: { 200: { description: 'Updated account; signedOut=true', content: json(envelope({ ...profile, properties: { ...profile.properties, signedOut: { const: true } } })) }, ...failures } })
const root = '/companies/{companyId}/documents'
export const privatePaths = {
  '/auth/me': {
    get: { tags: ['Account'], summary: 'Read your own profile', responses: { 200: { description: 'Profile without password or hash', content: json(envelope(profile)) }, ...failures } },
    patch: changes('Update your own name and email', profileSchema),
  },
  '/auth/change-password': { post: changes('Change your password and invalidate every session', passwordSchema) },
  [root]: {
    parameters: [company],
    get: { tags: ['Documents'], summary: 'List private file metadata', parameters: [
      { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'pageSize', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
      { name: 'search', in: 'query', schema: { type: 'string', maxLength: 200 } }, { name: 'archived', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
    ], responses: { 200: { description: 'Paginated metadata; no public URLs or file bytes', content: json({ type: 'object', properties: { data: { type: 'array', items: record }, total: { type: 'integer' }, page: { type: 'integer' }, pageSize: { type: 'integer' }, totalPages: { type: 'integer' } } }) }, ...failures } },
    post: { tags: ['Documents'], summary: 'Upload a private PDF or image', description: 'Requires Documents create. Maximum 10 MB per file, 500 MB per company including archives. PDF/PNG/JPEG/WebP extension and signature checks; these do not constitute malware scanning. X-Document-Metadata is base64 UTF-8 JSON: name, fileName, size, category, reference, notes. Files are stored with SHA-256 integrity metadata and included in database backups.',
      parameters: [{ name: 'X-Document-Metadata', in: 'header', required: true, schema: { type: 'string', maxLength: 8192 } }], requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, responses: { 201: { description: 'Saved metadata', content: json(envelope(record)) }, ...failures } },
  },
  [`${root}/{id}/content`]: { parameters: [company, id], get: { tags: ['Documents'], summary: 'Download private bytes after company authorization and integrity check', responses: { 200: { description: 'Forced attachment; no-store, nosniff and sandbox headers', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } }, ...failures } } },
  [`${root}/{id}`]: { parameters: [company, id], delete: { tags: ['Documents'], summary: 'Archive a file without destroying its contents', parameters: [{ name: 'expectedVersion', in: 'query', required: true, schema: version }], responses: { 204: { description: 'Archived' }, ...failures } } },
  [`${root}/{id}/restore`]: { parameters: [company, id], post: { tags: ['Documents'], summary: 'Restore an archived file', requestBody: body({ type: 'object', additionalProperties: false, required: ['expectedVersion'], properties: { expectedVersion: version } }), responses: { 200: { description: 'Restored metadata', content: json(envelope(record)) }, ...failures } } },
}
