// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'
import AccountSetupEditor from '../features/accounting/setup/AccountSetupEditor.vue'
import { accountStore, categoryStore } from '../features/accounting/setup/accountSetupData'

beforeAll(async () => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  await Promise.all([accountStore.ensureLoaded(), categoryStore.ensureLoaded()])
})

describe('account setup editor persistence contract', () => {
  it.each(['account', 'category'] as const)('preserves %s version and waits for server confirmation before closing', async (kind) => {
    const record = kind === 'account' ? accountStore.items.value[0]! : categoryStore.items.value[0]!
    const wrapper = mount(AccountSetupEditor, { props: { open: true, kind, record: { ...record, version: 7 } } })
    await wrapper.get('form').trigger('submit')
    const event = kind === 'account' ? 'saveAccount' : 'saveCategory'
    expect(wrapper.emitted(event)?.[0]?.[0]).toMatchObject({ id: record.id, version: 7 })
    expect(wrapper.emitted('close')).toBeUndefined()
    await wrapper.setProps({ serverError: 'Someone else changed this record. Reload it and try again.' })
    expect(wrapper.get('[role="alert"]').text()).toContain('Reload')
    expect(wrapper.get('input[maxlength="120"]').element).toHaveProperty('value', record.name)
    wrapper.unmount()
  })
  it('blocks save and closing while a request is pending', async () => {
    const wrapper = mount(AccountSetupEditor, { props: { open: true, kind: 'account', record: accountStore.items.value[0]!, busy: true } })
    await wrapper.get('form').trigger('submit')
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.emitted('saveAccount')).toBeUndefined()
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.get('button[type="submit"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
  it('renders a read-only editor without save or delete actions', () => {
    const wrapper = mount(AccountSetupEditor, { props: { open: false, kind: 'category', record: categoryStore.items.value[0]!, canSave: false, canDelete: false } })
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.find('.setup-button--danger').exists()).toBe(false)
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
