// @vitest-environment jsdom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DashboardPage from '../features/dashboard/DashboardPage.vue'
import type { DashboardSnapshot } from '../features/dashboard/dashboardContract'
import { UnauthorizedError } from '../lib/asyncState'

const api = vi.hoisted(() => ({ get: vi.fn(), can: vi.fn(() => true) }))
vi.mock('../services/api/httpClient', () => ({ http: { get: api.get } }))
vi.mock('../features/auth/permissions', () => ({ usePermissions: () => ({ can: api.can }) }))
enableAutoUnmount(afterEach)
afterEach(() => { api.can.mockReturnValue(true); api.get.mockReset() })
const empty = (): DashboardSnapshot => ({ companyName: 'Joyno', sourceLabel: 'Posted entries', bankBalanceCents: null, receivablesCents: null, payablesCents: null, revenueCents: 0, expensesCents: 0, unjournalizedCount: 0, trends: [], deadlines: [], activities: [] })

describe('dashboard data states', () => {
  it('uses a dashboard skeleton while waiting, without showing zero financial metrics', async () => {
    let finish!: (result: { data: DashboardSnapshot }) => void
    api.get.mockReturnValue(new Promise((resolve) => { finish = resolve }))
    const wrapper = mount(DashboardPage)
    expect(wrapper.find('.app-skeleton--dashboard').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('₱0.00')
    expect(wrapper.find('.dashboard-chart').exists()).toBe(false)
    finish({ data: empty() })
    await flushPromises()
    expect(wrapper.find('.app-skeleton').exists()).toBe(false)
    expect(wrapper.text()).toContain('No posted revenue or expenses')
    expect(wrapper.text()).toContain('No recorded filing deadlines')
    expect(wrapper.text()).toContain('Some balance accounts are not mapped yet.')
    expect(wrapper.find('.dashboard-chart').exists()).toBe(false)
    expect(wrapper.find('.dashboard-legend').exists()).toBe(false)
  })
  it('retains real recent activity independently of an empty chart', async () => {
    api.get.mockResolvedValue({ data: { ...empty(), activities: [{ id: 'audit', at: '2026-10-06T06:00:00Z', action: 'Created', reference: 'Invoice: REAL-1', module: 'Sales' }] } })
    const wrapper = mount(DashboardPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Invoice: REAL-1')
    expect(wrapper.find('.dashboard-chart').exists()).toBe(false)
    await wrapper.get('.dashboard-panel--trend .app-empty-state button').trigger('click')
    expect(wrapper.emitted('navigate')).toEqual([['general-journal']])
  })
  it.each([new Error('Unavailable'), new UnauthorizedError('Access restricted')])('renders failures instead of blank content and retries', async (error) => {
    api.get.mockRejectedValueOnce(error).mockResolvedValueOnce({ data: empty() })
    const wrapper = mount(DashboardPage)
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toContain(error.message)
    expect(wrapper.find('.dashboard-summary').exists()).toBe(false)
    await wrapper.get('[role="alert"] button').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('No posted revenue or expenses')
  })
  it('does not claim there are no tax deadlines when the user lacks tax access', async () => {
    api.can.mockReturnValue(false)
    api.get.mockResolvedValue({ data: empty() })
    const wrapper = mount(DashboardPage)
    await flushPromises()
    expect(wrapper.text()).toContain('Tax calendar access restricted')
    expect(wrapper.text()).not.toContain('No recorded filing deadlines')
    expect(wrapper.find('.dashboard-panel--calendar button').exists()).toBe(false)
    expect(wrapper.find('.dashboard-setup-note button').exists()).toBe(false)
  })
  it('keeps genuine zero balances distinct from missing mappings and renders populated charts', async () => {
    api.get.mockResolvedValue({ data: { ...empty(), bankBalanceCents: 0, receivablesCents: 0, payablesCents: 0, revenueCents: 10000, trends: [{ month: '2026-10', revenueCents: 10000, expenseCents: 0 }], deadlines: [{ id: 'deadline', dueDate: '2026-10-20', form: '2550M', detail: 'Recorded deadline' }] } })
    const wrapper = mount(DashboardPage)
    await flushPromises()
    expect(wrapper.find('.dashboard-chart').exists()).toBe(true)
    expect(wrapper.find('.dashboard-calendar').exists()).toBe(true)
    expect(wrapper.find('.dashboard-setup-note').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Not set up')
    expect(wrapper.get('.dashboard-chart__bar--expense').attributes('style')).toContain('height: 0%')
  })
})
