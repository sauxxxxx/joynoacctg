// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PurchasesPage from '../features/purchases/PurchasesPage.vue'
import PurchasesTable from '../features/purchases/PurchasesTable.vue'
import { purchaseRecords, type PurchaseKind, type PurchaseRecord } from '../features/purchases/purchasePreviewData'

const controls = vi.hoisted(() => ({ loading: false, error: '', canCreate: true }))
vi.mock('../services/useRecordWorkspace', async () => {
  const { ref } = await import('vue')
  return { useRecordWorkspace: () => ({ loading: ref(controls.loading), busy: ref(false), error: ref(controls.error), load: vi.fn(), save: vi.fn(), remove: vi.fn() }) }
})
vi.mock('../features/transactions/useDocumentReferences', async () => {
  const { ref } = await import('vue')
  return { useDocumentReferences: () => ({ loading: ref(false), error: ref(''), load: vi.fn() }) }
})
vi.mock('../features/auth/permissions', () => ({ usePermissions: () => ({ can: (_module: string, action: string) => action !== 'create' || controls.canCreate }) }))

function record(): PurchaseRecord {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { id: 'fixture', kind: 'purchase-invoices', number: 'INV-1', date, vendorId: '', amountCents: 10000, totalCents: 10000, paidCents: 0, status: 'Draft', remarks: '', paymentMethod: '', paymentTerms: '', checkNumber: '', taxCents: 0, lines: [], month: '', year: '', period: '', payrollFrequency: '', payGroup: '', accrualJE: '' }
}
const mountPage = () => mount(PurchasesPage, { props: { kind: 'purchase-invoices' }, global: { stubs: { PurchasesEditor: true, AppDatePicker: true, AppSelect: true } } })
beforeEach(() => { purchaseRecords.value = []; controls.loading = false; controls.error = ''; controls.canCreate = true })

describe('purchase empty and populated layouts', () => {
  it.each(['purchase-invoices', 'payrolls', 'cash-voucher', 'check-voucher', 'petty-cash-voucher', 'purchase-receipts'] as PurchaseKind[])('hides empty table headers, scrolling and totals for %s', async (kind) => {
    const wrapper = mount(PurchasesTable, { props: { kind, records: [], filtered: false, canCreate: true, createLabel: 'New record' } })
    expect(wrapper.find('table').exists()).toBe(false)
    expect(wrapper.find('.purchases-results__scroll').exists()).toBe(false)
    expect(wrapper.find('footer').exists()).toBe(false)
    expect(wrapper.get('[role="status"]').text()).toContain('yet')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('add')).toHaveLength(1)
    wrapper.unmount()
  })
  it('shows one create action and no pagination when the register is empty', () => {
    const wrapper = mountPage()
    expect(wrapper.get('.purchases-workspace').classes()).toContain('purchases-workspace--empty')
    expect(wrapper.findAll('button').filter((button) => button.text() === 'New invoice')).toHaveLength(1)
    expect(wrapper.find('.app-pagination').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps pagination after the full table and restores it after clearing a search', async () => {
    purchaseRecords.value = [record()]
    const wrapper = mountPage()
    expect(wrapper.get('.purchases-results').element.nextElementSibling).toBe(wrapper.get('.app-pagination').element)
    expect(wrapper.get('footer').text()).toContain('100.00')
    await wrapper.get('input[type="search"]').setValue('unmatched')
    expect(wrapper.get('[role="status"]').text()).toContain('No matching invoices')
    expect(wrapper.find('.app-pagination').exists()).toBe(false)
    expect(wrapper.find('footer').exists()).toBe(false)
    await wrapper.get('.purchases-empty button').trigger('click')
    expect(wrapper.find('.app-pagination').exists()).toBe(true)
    expect(wrapper.find('.purchases-empty').exists()).toBe(false)
    wrapper.unmount()
  })
  it('does not offer record creation to a read-only user', () => {
    controls.canCreate = false
    const wrapper = mountPage()
    expect(wrapper.find('.purchases-empty button').exists()).toBe(false)
    wrapper.unmount()
  })
  it.each(['loading', 'error'] as const)('does not present an empty register while %s', (state) => {
    if (state === 'loading') controls.loading = true
    else controls.error = 'Unable to load saved records.'
    const wrapper = mountPage()
    expect(wrapper.find('.purchases-empty').exists()).toBe(false)
    expect(wrapper.find('.app-pagination').exists()).toBe(false)
    expect(wrapper.text()).toContain(state === 'loading' ? 'Loading records' : controls.error)
    wrapper.unmount()
  })
})
