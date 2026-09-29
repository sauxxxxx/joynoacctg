<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'
import PurchaseJournalPage from './features/accounting/journals/PurchaseJournalPage.vue'
import AccountingReportsPage from './features/accounting/reports/AccountingReportsPage.vue'
import { accountingReportPageIds, analyticsPageIds, asPageId } from './features/accounting/reports/reportPages'
import AnalyticsPage from './features/accounting/analytics/AnalyticsPage.vue'
import CompanyPage from './features/company/CompanyPage.vue'
import { companyPageIds } from './features/company/companyPages'
import CustomersPage from './features/sales/customers/CustomersPage.vue'
import SalesDocumentsPage from './features/sales/SalesDocumentsPage.vue'
import SalesReportsPage from './features/sales/SalesReportsPage.vue'
import SalesSetupPage from './features/sales/SalesSetupPage.vue'
import type { DocumentKind, SetupKind } from './features/sales/salesPreviewStore'
import { findPage } from './navigation'

const activeId = ref('dashboard')
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)
const activePage = computed(() => findPage(activeId.value) ?? findPage('dashboard')!)
const documentIds: DocumentKind[] = ['sales-invoices', 'sales-receipts', 'acknowledgement-receipts']
const setupIds: SetupKind[] = ['sales-payment-terms', 'sales-payment-methods', 'sales-discount-types']
const reportIds = ['receivable-schedule', 'receivable-aging'] as const
const documentPageId = computed(() => documentIds.find((id) => id === activeId.value))
const setupPageId = computed(() => setupIds.find((id) => id === activeId.value))
const reportPageId = computed(() => reportIds.find((id) => id === activeId.value))
const accountingReportId = computed(() => asPageId(accountingReportPageIds, activeId.value))
const analyticsId = computed(() => asPageId(analyticsPageIds, activeId.value))
const companyId = computed(() => asPageId(companyPageIds, activeId.value))
const isSalesPage = computed(() => activeId.value === 'customers' || Boolean(documentPageId.value || setupPageId.value || reportPageId.value))

function syncViewport() {
  isMobile.value = window.matchMedia('(max-width: 900px)').matches
  if (!isMobile.value) mobileOpen.value = false
}

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeMobile() {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  nextTick(() => document.querySelector<HTMLButtonElement>('.topbar__sidebar-toggle')?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMobile()
}

function selectPage(id: string) {
  activeId.value = id
  const url = new URL(window.location.href)
  if (id === 'dashboard') url.searchParams.delete('page')
  else url.searchParams.set('page', id)
  window.history.pushState(null, '', url)
}

function syncPageFromUrl() {
  const id = new URL(window.location.href).searchParams.get('page')
  activeId.value = id && findPage(id) ? id : 'dashboard'
}

watch(activePage, (page) => { document.title = `${page.label} | Joyno Accounting` })

onMounted(() => {
  syncPageFromUrl()
  syncViewport()
  window.addEventListener('resize', syncViewport)
  window.addEventListener('popstate', syncPageFromUrl)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
  window.removeEventListener('popstate', syncPageFromUrl)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <AppSidebar
      :active-id="activeId"
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      @select="selectPage"
      @close="closeMobile"
      @expand="sidebarCollapsed = false"
    />
    <div class="app-shell__body" :inert="mobileOpen">
      <AppTopbar :collapsed="sidebarCollapsed" :is-mobile="isMobile" @toggle-sidebar="toggleSidebar" @select="selectPage" />
      <main id="main-content" class="page-content" :class="{ 'page-content--journal': activeId === 'purchase-journal' }" tabindex="-1">
        <div v-if="!isSalesPage" class="page-content__heading">
          <nav v-if="activePage.path.length > 1" class="breadcrumbs" aria-label="Breadcrumb">
            <template v-for="(part, index) in activePage.path" :key="`${part}-${index}`">
              <span v-if="index > 0" class="breadcrumbs__divider">/</span><span :class="{ 'breadcrumbs__current': index === activePage.path.length - 1 }">{{ part }}</span>
            </template>
          </nav>
          <h1>{{ activePage.label }}</h1>
        </div>
        <div class="page-content__canvas">
          <PurchaseJournalPage v-if="activeId === 'purchase-journal'" />
          <CustomersPage v-else-if="activeId === 'customers'" />
          <SalesDocumentsPage v-else-if="documentPageId" :page-id="documentPageId" />
          <SalesSetupPage v-else-if="setupPageId" :page-id="setupPageId" />
          <SalesReportsPage v-else-if="reportPageId" :page-id="reportPageId" />
          <AccountingReportsPage v-else-if="accountingReportId" :page-id="accountingReportId" @navigate="selectPage" />
          <AnalyticsPage v-else-if="analyticsId" :key="analyticsId" :page-id="analyticsId" />
          <CompanyPage v-else-if="companyId" :key="companyId" :page-id="companyId" />
        </div>
      </main>
    </div>
  </div>
</template>
