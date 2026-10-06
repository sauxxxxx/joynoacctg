// @vitest-environment jsdom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { asyncPage } from '../services/asyncPage'
import AsyncPageError from '../components/ui/AsyncPageError.vue'

enableAutoUnmount(afterEach)
describe('lazy page states', () => {
  it('renders a skeleton immediately while route code is downloading', async () => {
    let finish!: (value: { template: string }) => void
    const component = asyncPage(() => new Promise((resolve) => { finish = resolve }))
    const wrapper = mount({ components: { LazyPage: component }, template: '<div><LazyPage /></div>' })
    expect(wrapper.find('.app-skeleton').exists()).toBe(true)
    finish({ template: '<div class="loaded-page">Ready</div>' })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('.loaded-page').exists()).toBe(true))
    expect(wrapper.find('.app-skeleton').exists()).toBe(false)
    expect(wrapper.get('.loaded-page').text()).toBe('Ready')
  })
  it('shows a friendly error instead of exposing internal route-download exceptions', () => {
    const wrapper = mount(AsyncPageError, { props: { error: new Error('INTERNAL CHUNK PATH SECRET') } })
    expect(wrapper.get('[role="alert"]').text()).toContain('The page could not be opened.')
    expect(wrapper.text()).not.toContain('INTERNAL CHUNK PATH SECRET')
    expect(wrapper.get('button').text()).toBe('Try again')
  })
  it('switches to a retry panel when the route loader fails', async () => {
    const wrapper = mount({ components: { LazyPage: asyncPage(() => Promise.reject(new Error('Offline'))) }, template: '<div><LazyPage /></div>' }, { global: { config: { errorHandler: vi.fn() } } })
    await flushPromises()
    await vi.waitFor(() => expect(wrapper.find('[role="alert"]').exists()).toBe(true))
    expect(wrapper.find('.app-skeleton').exists()).toBe(false)
    expect(wrapper.get('[role="alert"]').text()).toContain('Check your connection')
  })
})
