// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiAuthService } from '../features/auth/apiAuthService'
import { request } from '../services/api/httpClient'
import { onSessionExpired, setApiCredentials } from '../services/api/session'
import { createHttpRepository } from '../services/repository'

vi.mock('../services/api/config', () => ({ apiConfig: { baseUrl: '/vps-api', timeoutMs: 1000 } }))

const fetchMock = vi.fn()
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
const signInData = {
  accessToken: 'test-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
  user: { id: 'u1', username: 'admin', name: 'Admin', email: '', active: true },
  memberships: [{ companyId: 'company-1', companyName: 'Joyno', role: 'Administrator', permissions: {} }],
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  setApiCredentials({ accessToken: 'test-token', companyId: 'company-1' })
})
afterEach(() => { setApiCredentials(null); onSessionExpired(() => {}); vi.unstubAllGlobals() })

describe('connected API frontend contract', () => {
  it('signs in without a tenant prefix and carries the server company identity', async () => {
    fetchMock.mockResolvedValue(reply({ data: signInData }))
    const session = await apiAuthService.signIn({ username: 'admin', password: 'test-only-password' })
    expect(session.user.companyName).toBe('Joyno')
    expect(session.companyId).toBe('company-1')
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/vps-api/api/v1/auth/sign-in')
  })
  it.each([undefined, 500])('provides user-facing help on connection failures (%s)', async (status) => {
    if (status) fetchMock.mockResolvedValue(reply({}, status))
    else fetchMock.mockRejectedValue(new TypeError('fetch failed'))
    await expect(apiAuthService.signIn({ username: 'admin', password: 'test-only-password' })).rejects.toThrow('contact your administrator')
  })
  it('rejects an expired server session', async () => {
    fetchMock.mockResolvedValue(reply({ data: { ...signInData, expiresAt: '2020-01-01T00:00:00Z' } }))
    await expect(apiAuthService.signIn({ username: 'admin', password: 'test-only-password' })).rejects.toThrow('invalid session')
  })
  it('sends tenant credentials and expected versions for edits and deletes', async () => {
    const record = { id: 'account-1', version: 3, name: 'Cash' }
    fetchMock.mockImplementation(async () => reply({ data: { ...record, version: 4 } }))
    const repository = createHttpRepository<typeof record>('/accounts')
    await repository.save(record)
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toContain('/companies/company-1/accounts/account-1')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    expect(JSON.parse(options.body)).toEqual({ name: 'Cash', expectedVersion: 3 })
    await repository.remove(record.id, 4)
    expect(fetchMock.mock.calls[1]?.[0]).toContain('expectedVersion=4')
    expect(fetchMock.mock.calls[1]?.[1].method).toBe('DELETE')
  })
  it('does not expire a new login after a delayed old-token rejection', async () => {
    const expired = vi.fn()
    onSessionExpired(expired)
    fetchMock.mockImplementation(async () => {
      setApiCredentials({ accessToken: 'new-token', companyId: 'company-1' })
      return reply({}, 401)
    })
    await expect(request('GET', '/accounts')).rejects.toThrow()
    expect(expired).not.toHaveBeenCalled()
    fetchMock.mockResolvedValue(reply({}, 401))
    await expect(request('GET', '/accounts')).rejects.toThrow()
    expect(expired).toHaveBeenCalledOnce()
  })
  it('sends authenticated raw files and returns binary downloads without JSON conversion', async () => {
    const file = new Blob(['private file'], { type: 'application/pdf' })
    fetchMock.mockResolvedValue(reply({ data: { id: 'file-1' } }))
    await request('POST', '/documents', { binaryBody: file, metadata: 'encoded-metadata' })
    const [url, options] = fetchMock.mock.calls[0]!
    expect(url).toContain('/companies/company-1/documents')
    expect(options.body).toBe(file)
    expect(options.headers['Content-Type']).toBe('application/octet-stream')
    expect(options.headers['X-Document-Metadata']).toBe('encoded-metadata')
    expect(options.headers.Authorization).toBe('Bearer test-token')
    fetchMock.mockResolvedValue(new Response('private file', { headers: { 'Content-Type': 'application/pdf' } }))
    const content = await request<Blob>('GET', '/documents/file-1/content', { responseType: 'blob' })
    expect(content.size).toBe(12)
    expect(content.type).toBe('application/pdf')
    fetchMock.mockResolvedValue(reply({ error: { code: 'FORBIDDEN', message: 'Access denied.' } }, 403))
    await expect(request('GET', '/documents/file-1/content', { responseType: 'blob' })).rejects.toThrow('Access denied.')
  })
})
