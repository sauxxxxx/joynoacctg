// @vitest-environment jsdom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SalesReportsPage from '../features/sales/SalesReportsPage.vue'
import PurchaseReportsPage from '../features/purchases/reports/PurchaseReportsPage.vue'
import BankAccountsPage from '../features/banking/BankAccountsPage.vue'
import BankTransactionsPage from '../features/banking/BankTransactionsPage.vue'
import { purchaseRecords } from '../features/purchases/purchasePreviewData'
import { salesDocuments } from '../features/sales/salesPreviewStore'

const controls = vi.hoisted(() => ({ loading: false, error: '', referencesLoading: false, referencesError: '', retry: vi.fn() }))
vi.mock('../services/useRecordWorkspace', async () => {
  const { ref } = await import('vue')
  return { useRecordWorkspace: () => ({ loading: ref(controls.loading), busy: ref(false), error: ref(controls.error), load: controls.retry, save: vi.fn(), remove: vi.fn() }) }
})
vi.mock('../features/transactions/useDocumentReferences', async () => {
  const { ref } = await import('vue')
  return { useDocumentReferences: () => ({ loading: ref(controls.referencesLoading), error: ref(controls.referencesError), load: controls.retry }) }
})
vi.mock('../services/collectionStore', async (importOriginal) => {
  const original = await importOriginal<typeof import('../services/collectionStore')>()
  const { ref } = await import('vue')
  return { ...original, useCollections: () => ({ loading: ref(controls.referencesLoading), error: ref(controls.referencesError), retry: controls.retry }) }
})
vi.mock('../lib/useRepositoryList', async () => {
  const { ref } = await import('vue')
  return { useRepositoryList: () => ({ status: ref(controls.loading ? 'loading' : controls.error ? 'error' : 'ready'), error: ref(controls.error), items: ref([]), page: ref(1), pageSize: 25, totalItems: ref(0), summary: ref({ amountCents: 10000 }), reload: controls.retry }) }
})
enableAutoUnmount(afterEach)
beforeEach(() => { purchaseRecords.value = []; salesDocuments.value = []; controls.loading = false; controls.error = ''; controls.referencesLoading = false; controls.referencesError = ''; controls.retry.mockClear() })
const stubs = { AppSelect: true, AppDatePicker: true, DateRangeFilter: true, BankAccountEditor: true, BankTransactionEditor: true }

describe('report loading and empty guards', () => {
  const reports = [
    ['receivable-aging', SalesReportsPage], ['receivable-schedule', SalesReportsPage],
    ['payable-aging', PurchaseReportsPage], ['payable-schedule', PurchaseReportsPage], ['revolving-fund-logs', PurchaseReportsPage],
  ] as const
  for (const [pageId, component] of reports) {
    it.each(['loading', 'error', 'empty'] as const)(`${pageId}: %s never displays empty tables or zero totals`, async (state) => {
      controls.loading = state === 'loading'
      controls.error = state === 'error' ? 'Records could not be loaded.' : ''
      const wrapper = mount(component, { props: { pageId }, global: { stubs } })
      expect(wrapper.find('table').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('0.00')
      expect(wrapper.find('.app-skeleton').exists()).toBe(state === 'loading')
      expect(wrapper.find('.app-empty-state').exists()).toBe(state === 'empty')
      if (state === 'error') {
        expect(wrapper.get('[role="alert"]').text()).toContain(controls.error)
        await wrapper.get('[role="alert"] button').trigger('click')
        expect(controls.retry).toHaveBeenCalled()
      }
    })
  }
})

describe('banking hides pagination and totals until ready and populated', () => {
  for (const component of [BankAccountsPage, BankTransactionsPage]) {
    it.each(['loading', 'error', 'references', 'empty'] as const)(`${component.__name}: %s`, (state) => {
      controls.loading = state === 'loading'
      controls.error = state === 'error' ? 'Bank records unavailable.' : ''
      controls.referencesLoading = state === 'references'
      const wrapper = mount(component, { global: { stubs } })
      expect(wrapper.find('table').exists()).toBe(false)
      expect(wrapper.find('.app-pagination').exists()).toBe(false)
      expect(wrapper.find('footer').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('100.00')
      expect(wrapper.find('.app-empty-state').exists()).toBe(state === 'empty')
      expect(wrapper.find('.app-skeleton').exists()).toBe(state === 'loading' || state === 'references')
    })
  }
})
