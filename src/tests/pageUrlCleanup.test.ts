// @vitest-environment jsdom
import { enableAutoUnmount, flushPromises, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App.vue'
import { useAuth } from '../features/auth/authStore'

vi.mock('../features/auth/LoginPage.vue', () => ({ default: { name: 'LoginPage', props: ['loading', 'error'], emits: ['signIn', 'clearError'], template: '<div />' } }))
vi.mock('../features/dashboard/DashboardPage.vue', () => ({ default: { name: 'DashboardPage', template: '<div />' } }))
vi.mock('../features/accounting/reports/AccountingReportsPage.vue', () => ({ default: { name: 'AccountingReportsPage', props: ['pageId'], template: '<div />' } }))
vi.mock('../features/auth/authStore', async () => {
  const { ref } = await import('vue')
  const authUser = ref<import('../features/auth/authTypes').AuthUser | null>(null)
  return { useAuth: () => ({ authUser, authenticating: ref(false), authError: ref(''), signIn: vi.fn(async () => true), signOut: vi.fn(() => { authUser.value = null }), clearAuthError: vi.fn() }) }
})
const session = useAuth()
const admin = { id: 'fixture', username: 'admin', email: '', name: 'Admin', role: 'Administrator', active: true }
const mountApp = () => shallowMount(App, { global: { stubs: { AccountingReportsPage: { name: 'AccountingReportsPage', props: ['pageId'], template: '<div />' }, DashboardPage: true } } })
enableAutoUnmount(afterEach)
afterEach(() => { vi.unstubAllGlobals() })

beforeEach(() => {
  session.authUser.value = null
  window.history.replaceState(null, '', '/?mode=preview&page=trial-balance')
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false })))
})

describe('application URL cleanup', () => {
  it('cleans an old link before sign-in without adding history or losing page selection', () => {
    const state = { restored: true }
    window.history.replaceState(state, '', window.location.href)
    const historyLength = window.history.length
    const wrapper = mountApp()
    expect(window.location.search).toBe('?page=trial-balance')
    expect(window.history.state).toEqual(state)
    expect(window.history.length).toBe(historyLength)
    expect(wrapper.findComponent({ name: 'LoginPage' }).exists()).toBe(true)
  })
  it('retains the requested report after sign-in', async () => {
    const wrapper = mountApp()
    const login = wrapper.getComponent({ name: 'LoginPage' })
    session.authUser.value = admin
    login.vm.$emit('sign-in', { username: 'fixture', password: 'fixture' })
    await flushPromises()
    expect(wrapper.getComponent({ name: 'AccountingReportsPage' }).props('pageId')).toBe('trial-balance')
    expect(window.location.search).toBe('?page=trial-balance')
  })
  it('does not carry mode parameters into new navigation links', async () => {
    session.authUser.value = admin
    const wrapper = mountApp()
    window.history.replaceState(null, '', '/?mode=connected&page=trial-balance&filter=keep#main-content')
    wrapper.getComponent({ name: 'AppSidebar' }).vm.$emit('select', 'balance-sheet')
    await flushPromises()
    expect(window.location.search).toBe('?page=balance-sheet&filter=keep')
    expect(window.location.hash).toBe('#main-content')
    expect(wrapper.getComponent({ name: 'AccountingReportsPage' }).props('pageId')).toBe('balance-sheet')
  })
  it('cleans restored browser-history links and selects their requested page', async () => {
    session.authUser.value = admin
    const wrapper = mountApp()
    window.history.pushState({ restored: true }, '', '/?mode=preview&page=balance-sheet')
    window.dispatchEvent(new PopStateEvent('popstate'))
    await flushPromises()
    expect(window.location.search).toBe('?page=balance-sheet')
    expect(window.history.state).toEqual({ restored: true })
    expect(wrapper.getComponent({ name: 'AccountingReportsPage' }).props('pageId')).toBe('balance-sheet')
  })
  it('clears page and obsolete mode parameters at sign-out', async () => {
    session.authUser.value = admin
    const wrapper = mountApp()
    window.history.replaceState(null, '', '/?mode=preview&page=trial-balance')
    wrapper.getComponent({ name: 'AppTopbar' }).vm.$emit('logout')
    await flushPromises()
    expect(window.location.search).toBe('')
    expect(session.authUser.value).toBeNull()
    expect(wrapper.findComponent({ name: 'LoginPage' }).exists()).toBe(true)
  })
})
