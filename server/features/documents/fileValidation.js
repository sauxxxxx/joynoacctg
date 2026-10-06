import { createHash } from 'node:crypto'
import { ApiFailure } from '../../http/errors.js'
import { MAX_FILE_BYTES, uploadSchema } from './documentSchemas.js'
const invalid = (message) => new ApiFailure('VALIDATION_ERROR', 422, message)
export function readMetadata(header) {
  if (!header || header.length > 8192 || !/^[A-Za-z0-9+/]+={0,2}$/.test(header)) throw invalid('Upload metadata is missing or invalid.')
  let value
  try { value = JSON.parse(Buffer.from(header, 'base64').toString('utf8')) } catch { throw invalid('Upload metadata is invalid.') }
  return uploadSchema.parse(value)
}
export function inspectFile(bytes, metadata) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_FILE_BYTES || bytes.length !== metadata.size) throw invalid('Choose a nonempty file up to 10 MB. Its uploaded size must match.')
  let mimeType; let extension
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) { mimeType = 'image/png'; extension = 'png' }
  else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) { mimeType = 'image/jpeg'; extension = 'jpg' }
  else if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') { mimeType = 'image/webp'; extension = 'webp' }
  else if (bytes.subarray(0, 5).toString('ascii') === '%PDF-' && bytes.subarray(-2048).includes(Buffer.from('%%EOF'))) { mimeType = 'application/pdf'; extension = 'pdf' }
  else throw invalid('Upload a PDF, PNG, JPEG, or WebP file. Other formats are not accepted.')
  const suffix = metadata.fileName.split('.').at(-1)?.toLowerCase()
  if (suffix !== extension && !(extension === 'jpg' && suffix === 'jpeg')) throw invalid('The filename extension does not match the file content.')
  return { mimeType, extension, sha256: createHash('sha256').update(bytes).digest('hex') }
}
