// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import AppDataState from '../components/ui/AppDataState.vue'
import AppSkeleton from '../components/ui/AppSkeleton.vue'
import AppLoadState from '../components/ui/AppLoadState.vue'

describe('shared loading, empty, error and ready states', () => {
  it.each(['table', 'report', 'dashboard', 'form'] as const)('renders an accessible %s skeleton without fake data', (variant) => {
    const wrapper = mount(AppSkeleton, { props: { variant, label: 'company records' } })
    expect(wrapper.get('[role="status"]').attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toBe('Loading company records…')
    expect(wrapper.get('.app-skeleton__layout').attributes('aria-hidden')).toBe('true')
    expect(wrapper.findAll('.app-skeleton__panel')).toHaveLength(variant === 'dashboard' ? 5 : 1)
    expect(wrapper.find('button').exists()).toBe(false)
  })
  it('shows loading instead of empty messages, errors, stale totals or controls', async () => {
    const wrapper = mount(AppDataState, { props: { loading: true, empty: true, error: 'Failed', label: 'Invoices' }, slots: { default: '<div class="records">PHP 12,000 <button>Next</button></div>' } })
    expect(wrapper.find('.app-skeleton').exists()).toBe(true)
    expect(wrapper.find('.app-empty-state').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.find('.records').exists()).toBe(false)
    await wrapper.setProps({ loading: false })
    expect(wrapper.get('[role="alert"]').text()).toContain('Failed')
    expect(wrapper.find('.records').exists()).toBe(false)
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
    await wrapper.setProps({ error: '' })
    expect(wrapper.get('.app-empty-state').text()).toContain('No records yet')
    expect(wrapper.find('.records').exists()).toBe(false)
    await wrapper.setProps({ empty: false })
    expect(wrapper.find('.records').exists()).toBe(true)
    expect(wrapper.find('.app-skeleton').exists()).toBe(false)
  })
  it('offers empty-state actions only when explicitly supplied by the page', async () => {
    const wrapper = mount(AppDataState, { props: { loading: false, empty: true, emptyTitle: 'No users yet', emptyMessage: 'Add someone when ready.' } })
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ actionLabel: 'Add user' })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
  it('upgrades legacy list loading indicators to skeletons', () => {
    const wrapper = mount(AppLoadState, { props: { status: 'loading', label: 'bank accounts' } })
    expect(wrapper.find('.app-skeleton').exists()).toBe(true)
    expect(wrapper.text()).toContain('Loading bank accounts')
  })
})
