import type { EntityResponseDto } from '../../contracts/dto'
import { request, http } from '../../services/api/httpClient'
import type { StoredDocument } from './companyStore'

export async function uploadDocument(file: File, details: { name: string; category: string; reference: string; notes: string }) {
  const bytes = new TextEncoder().encode(JSON.stringify({ ...details, fileName: file.name, size: file.size }))
  const metadata = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(''))
  return (await request<EntityResponseDto<StoredDocument>>('POST', '/documents', { binaryBody: file, metadata })).data
}

export async function downloadDocument(document: StoredDocument) {
  const blob = await request<Blob>('GET', `/documents/${encodeURIComponent(document.id)}/content`, { responseType: 'blob' })
  const url = URL.createObjectURL(blob)
  const link = window.document.createElement('a')
  link.href = url; link.download = document.fileName
  window.document.body.append(link); link.click(); link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function restoreDocument(document: StoredDocument) {
  return (await http.post<EntityResponseDto<StoredDocument>>(`/documents/${encodeURIComponent(document.id)}/restore`, { expectedVersion: document.version })).data
}
