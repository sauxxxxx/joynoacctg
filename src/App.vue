<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'
import AppConfirmDialog from './components/ui/AppConfirmDialog.vue'
import type { JournalPreviewKind } from './features/accounting/journals/journalPreviewData'
import LoginPage from './features/auth/LoginPage.vue'
import { useAuth } from './features/auth/authStore'
import type { AuthCredentials } from './features/auth/authTypes'
import type { PurchaseKind } from './features/purchases/purchasePreviewData'
import type { PurchaseSetupKind } from './features/purchases/setup/purchaseSetupData'
import type { PurchaseReportKind } from './features/purchases/reports/purchaseReportData'
import { isTaxFormId } from './features/government/tax/taxFormData'
import { isYearlyTaxFormId } from './features/government/tax/yearlyTaxData'
import { isTaxCertificateId } from './features/government/tax/taxCertificateData'
import { accountingReportPageIds, analyticsPageIds, asPageId } from './features/accounting/reports/reportPages'
import { companyPageIds } from './features/company/companyPages'
import type { DocumentKind, SetupKind } from './features/sales/salesPreviewStore'
import { findPage } from './navigation'
import { navigation } from './navigation'
import { canAccessPage, filterNavigation } from './features/auth/permissions'

const DashboardPage = defineAsyncComponent(() => import('./features/dashboard/DashboardPage.vue'))
const AccessDenied = defineAsyncComponent(() => import('./features/auth/AccessDenied.vue'))
const PurchaseJournalPage = defineAsyncComponent(() => import('./features/accounting/journals/PurchaseJournalPage.vue'))
const JournalPreviewPage = defineAsyncComponent(() => import('./features/accounting/journals/JournalPreviewPage.vue'))
const AccountSetupPage = defineAsyncComponent(() => import('./features/accounting/setup/AccountSetupPage.vue'))
const PurchasesPage = defineAsyncComponent(() => import('./features/purchases/PurchasesPage.vue'))
const PurchaseSetupPage = defineAsyncComponent(() => import('./features/purchases/setup/PurchaseSetupPage.vue'))
const PurchaseReportsPage = defineAsyncComponent(() => import('./features/purchases/reports/PurchaseReportsPage.vue'))
const TaxFormsPage = defineAsyncComponent(() => import('./features/government/tax/TaxFormsPage.vue'))
const YearlyTaxFormsPage = defineAsyncComponent(() => import('./features/government/tax/YearlyTaxFormsPage.vue'))
const TaxCertificatesPage = defineAsyncComponent(() => import('./features/government/tax/TaxCertificatesPage.vue'))
const BirBooksPage = defineAsyncComponent(() => import('./features/government/books/BirBooksPage.vue'))
const BankAccountsPage = defineAsyncComponent(() => import('./features/banking/BankAccountsPage.vue'))
const BankTransactionsPage = defineAsyncComponent(() => import('./features/banking/BankTransactionsPage.vue'))
const FixedAssetsPage = defineAsyncComponent(() => import('./features/assets/FixedAssetsPage.vue'))
const AccountingReportsPage = defineAsyncComponent(() => import('./features/accounting/reports/AccountingReportsPage.vue'))
const AnalyticsPage = defineAsyncComponent(() => import('./features/accounting/analytics/AnalyticsPage.vue'))
const CompanyPage = defineAsyncComponent(() => import('./features/company/CompanyPage.vue'))
const CustomersPage = defineAsyncComponent(() => import('./features/sales/customers/CustomersPage.vue'))
const SalesDocumentsPage = defineAsyncComponent(() => import('./features/sales/SalesDocumentsPage.vue'))
const SalesReportsPage = defineAsyncComponent(() => import('./features/sales/SalesReportsPage.vue'))
const SalesSetupPage = defineAsyncComponent(() => import('./features/sales/SalesSetupPage.vue'))

const activeId = ref('dashboard')
const { authUser, authenticating, authError, signIn, signOut, clearAuthError } = useAuth()
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)
const activePage = computed(() => findPage(activeId.value) ?? findPage('dashboard')!)
const allowedNavigation = computed(() => filterNavigation(navigation, authUser.value))
const allowedPageIds = computed(() => {
  const ids: string[] = []
  const visit = (items: typeof navigation) => items.forEach((item) => item.children ? visit(item.children) : ids.push(item.id))
  visit(allowedNavigation.value)
  return ids
})
const hasPageAccess = computed(() => canAccessPage(authUser.value, activeId.value))
const journalPreviewIds: JournalPreviewKind[] = ['cash-disbursement-journal', 'cash-receipt-journal', 'sales-journal', 'general-journal']
const journalPreviewId = computed(() => journalPreviewIds.find((id) => id === activeId.value))
const purchaseIds: PurchaseKind[] = ['purchase-invoices', 'payrolls', 'cash-voucher', 'check-voucher', 'petty-cash-voucher', 'purchase-receipts']
const purchasePageId = computed(() => purchaseIds.find((id) => id === activeId.value))
const purchaseSetupIds: PurchaseSetupKind[] = ['vendors', 'revolving-fund-customers', 'purchases-discount-types', 'purchases-payment-terms', 'purchases-payment-methods']
const purchaseSetupPageId = computed(() => purchaseSetupIds.find((id) => id === activeId.value))
const purchaseReportIds: PurchaseReportKind[] = ['payable-schedule', 'payable-aging', 'revolving-fund-logs']
const purchaseReportPageId = computed(() => purchaseReportIds.find((id) => id === activeId.value))
const taxFormPageId = computed(() => isTaxFormId(activeId.value) ? activeId.value : undefined)
const yearlyTaxFormPageId = computed(() => isYearlyTaxFormId(activeId.value) ? activeId.value : undefined)
const taxCertificatePageId = computed(() => isTaxCertificateId(activeId.value) ? activeId.value : undefined)
const isBankingPage = computed(() => activeId.value === 'bank-accounts' || activeId.value === 'bank-transactions')
const isFixedAssetsPage = computed(() => activeId.value === 'fixed-assets')
const accountSetupIds = ['chart-of-accounts', 'account-categories'] as const
const accountSetupPageId = computed(() => accountSetupIds.find((id) => id === activeId.value))
const isDataPage = computed(() => Boolean(purchasePageId.value || purchaseSetupPageId.value || purchaseReportPageId.value || accountSetupPageId.value || taxFormPageId.value || yearlyTaxFormPageId.value || taxCertificatePageId.value || isBankingPage.value || isFixedAssetsPage.value))
const isWorkspacePage = computed(() => activeId.value === 'purchase-journal' || Boolean(journalPreviewId.value) || isDataPage.value)
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

function handleSignIn(credentials: AuthCredentials) {
  void signIn(credentials)
}

function handleSignOut() {
  signOut()
  activeId.value = 'dashboard'
  const url = new URL(window.location.href)
  url.searchParams.delete('page')
  window.history.replaceState(null, '', url)
}

watch([activePage, authUser], ([page, user]) => {
  document.title = user ? `${hasPageAccess.value ? page.label : 'Access denied'} | Joyno Accounting` : 'Sign in | Joyno Accounting'
}, { immediate: true })

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
  <LoginPage v-if="!authUser" :loading="authenticating" :error="authError" @sign-in="handleSignIn" @clear-error="clearAuthError" />
  <template v-else>
    <a class="skip-link" href="#main-content">Skip to content</a>
    <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed, 'app-shell--journal': isWorkspacePage }">
      <AppSidebar
        :active-id="activeId"
        :items="allowedNavigation"
        :collapsed="sidebarCollapsed"
        :mobile-open="mobileOpen"
        :is-mobile="isMobile"
        @select="selectPage"
        @close="closeMobile"
        @expand="sidebarCollapsed = false"
      />
      <div class="app-shell__body" :inert="mobileOpen">
        <AppTopbar :collapsed="sidebarCollapsed" :is-mobile="isMobile" :user="authUser" :allowed-page-ids="allowedPageIds" @toggle-sidebar="toggleSidebar" @select="selectPage" @logout="handleSignOut" />
        <main id="main-content" class="page-content" :class="{ 'page-content--journal': isWorkspacePage, 'page-content--dashboard': activeId === 'dashboard' }" tabindex="-1">
          <div v-if="!isSalesPage && !isWorkspacePage && activeId !== 'dashboard'" class="page-content__heading">
            <nav v-if="activePage.path.length > 1" class="breadcrumbs" aria-label="Breadcrumb">
              <template v-for="(part, index) in activePage.path" :key="`${part}-${index}`">
                <span v-if="index > 0" class="breadcrumbs__divider">/</span><span :class="{ 'breadcrumbs__current': index === activePage.path.length - 1 }">{{ part }}</span>
              </template>
            </nav>
            <h1>{{ activePage.label }}</h1>
          </div>
          <div class="page-content__canvas">
            <AccessDenied v-if="!hasPageAccess" :page-name="activePage.label" @return="selectPage('dashboard')" />
            <DashboardPage v-else-if="activeId === 'dashboard'" @navigate="selectPage" />
            <BirBooksPage v-else-if="activeId === 'bir-books'" />
            <PurchaseJournalPage v-else-if="activeId === 'purchase-journal'" />
            <JournalPreviewPage v-else-if="journalPreviewId" :key="journalPreviewId" :kind="journalPreviewId" />
            <AccountSetupPage v-else-if="accountSetupPageId" :key="accountSetupPageId" :page-id="accountSetupPageId" />
            <PurchasesPage v-else-if="purchasePageId" :key="purchasePageId" :kind="purchasePageId" />
            <PurchaseSetupPage v-else-if="purchaseSetupPageId" :key="purchaseSetupPageId" :page-id="purchaseSetupPageId" />
            <PurchaseReportsPage v-else-if="purchaseReportPageId" :key="purchaseReportPageId" :page-id="purchaseReportPageId" />
            <TaxFormsPage v-else-if="taxFormPageId" :key="taxFormPageId" :form-id="taxFormPageId" />
            <YearlyTaxFormsPage v-else-if="yearlyTaxFormPageId" :key="yearlyTaxFormPageId" :form-id="yearlyTaxFormPageId" />
            <TaxCertificatesPage v-else-if="taxCertificatePageId" :key="taxCertificatePageId" :form-id="taxCertificatePageId" />
            <BankAccountsPage v-else-if="activeId === 'bank-accounts'" />
            <BankTransactionsPage v-else-if="activeId === 'bank-transactions'" />
            <FixedAssetsPage v-else-if="isFixedAssetsPage" />
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
  <AppConfirmDialog />
</template>
