import { describe, expect, it } from 'vitest'
import { isConnectedPage, isConnectedResource, resolveWorkspace, workspaceUrl } from '../services/api/workspacePolicy'

describe('preview and connected workspace boundaries', () => {
  it('uses real records locally and selects the private proxy', () => {
    expect(resolveWorkspace('', '', true)).toEqual({ mode: 'connected', connectedAvailable: true, baseUrl: '/vps-api' })
    expect(resolveWorkspace('?mode=connected', '', true).baseUrl).toBe('/vps-api')
  })
  it('ignores sample-mode URL requests and normalizes its API URL', () => {
    expect(resolveWorkspace('', ' https://example.test/// ', false).baseUrl).toBe('https://example.test')
    expect(resolveWorkspace('?mode=preview', 'https://example.test', false).mode).toBe('connected')
  })
  it('uses the same-origin API in production without extra configuration', () => {
    expect(resolveWorkspace('?mode=connected', '', false)).toEqual({ mode: 'connected', connectedAvailable: true, baseUrl: '' })
    expect(resolveWorkspace('', '', true, true)).toEqual({ mode: 'preview', connectedAvailable: false, baseUrl: '' })
  })
  it('allows only implemented resources and pages', () => {
    expect(isConnectedResource('/accounts')).toBe(true)
    expect(isConnectedResource('/account-categories')).toBe(true)
    expect(isConnectedResource('/journals')).toBe(false)
    expect(isConnectedPage('chart-of-accounts')).toBe(true)
    expect(isConnectedPage('account-categories')).toBe(true)
    expect(isConnectedPage('dashboard')).toBe(true)
    expect(isConnectedPage('company-profile')).toBe(true)
    expect(isConnectedResource('/company/user')).toBe(true)
    expect(isConnectedResource('/roles')).toBe(true)
  })
  it('switches on the same origin and drops unsupported page selection', () => {
    expect(workspaceUrl('http://localhost:5173/?page=sales-invoices&mode=preview', 'connected')).toBe('http://localhost:5173/?mode=connected')
  })
})
