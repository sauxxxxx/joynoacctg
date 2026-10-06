// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import AppConfirmDialog from '../components/ui/AppConfirmDialog.vue'
import { confirmAction } from '../services/dialogService'

describe('confirmation dialog top-layer behavior', () => {
  it('opens a native modal and resolves confirmation', async () => {
    const show = vi.fn(function (this: HTMLDialogElement) { this.open = true })
    HTMLDialogElement.prototype.showModal = show
    const wrapper = mount(AppConfirmDialog, { attachTo: document.body })
    const result = confirmAction({ title: 'Delete record?', message: 'Disposable record', confirmLabel: 'Delete' })
    await flushPromises()
    const modal = document.querySelector('dialog[role="alertdialog"]')
    expect(show).toHaveBeenCalledOnce()
    expect(modal).toHaveProperty('open', true)
    document.querySelector<HTMLButtonElement>('.confirm-dialog__button--primary')!.click()
    expect(await result).toBe(true)
    await flushPromises()
    expect(document.querySelector('dialog')).toBeNull()
    wrapper.unmount()
  })
})
