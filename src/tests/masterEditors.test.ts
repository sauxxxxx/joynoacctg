// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import SalesEditorShell from '../features/sales/SalesEditorShell.vue'
import PurchaseSetupEditor from '../features/purchases/setup/PurchaseSetupEditor.vue'

describe('persisted master record editors', () => {
  it('blocks save and close shortcuts while a write is pending', async () => {
    const wrapper = mount(SalesEditorShell, { props: { title: 'Customer', dirty: true, busy: true }, slots: { default: '<input value="Entered name" />' } })
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    await wrapper.get('form').trigger('submit')
    await wrapper.get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
  it('renders a read-only form without save controls', async () => {
    const wrapper = mount(SalesEditorShell, { props: { title: 'Customer', dirty: false, readonly: true }, slots: { default: '<input />' } })
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    await wrapper.get('form').trigger('submit')
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }))
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper.get('button[aria-label="Close"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })
  it('keeps the vendor draft open until the parent confirms a successful save', async () => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true })
    const wrapper = mount(PurchaseSetupEditor, { props: { open: true, kind: 'vendors', record: null, canDelete: true } })
    await flushPromises()
    await wrapper.get('input').setValue('Unsaved vendor')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ error: 'The server could not save this record.' })
    expect(wrapper.get('input').element.value).toBe('Unsaved vendor')
    expect(wrapper.get('[role="alert"]').text()).toContain('could not save')
    await wrapper.setProps({ busy: true })
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    await wrapper.get('form').trigger('submit')
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })
})
