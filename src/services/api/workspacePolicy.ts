export type WorkspaceMode = 'preview' | 'connected'

const connectedResources = new Set(['/accounts', '/account-categories', '/journal-entries', '/roles', '/company/user', '/audit-events',
  '/sales-documents', '/purchases', '/documents',
  '/customers', '/sales-setup', '/purchase-setup', '/bank-accounts', '/bank-transactions', '/fixed-assets',
  '/tax-forms', '/yearly-tax-forms', '/tax-certificates',
  '/settings/profile', '/settings/registration', '/settings/recording', '/settings/reporting', '/settings/tax', '/settings/mappings',
  '/company/owner', '/company/good', '/company/service', '/company/item', '/company/series', '/company/message template', '/company/report template'])
const connectedPages = new Set(['dashboard', 'chart-of-accounts', 'account-categories', 'general-journal', 'general-ledger', 'trial-balance', 'income-statement-annual', 'income-statement-annual-simple', 'income-statement-monthly-simple', 'balance-sheet',
  'sales-invoices', 'sales-receipts', 'acknowledgement-receipts', 'purchase-invoices', 'payrolls', 'cash-voucher', 'check-voucher', 'petty-cash-voucher', 'purchase-receipts',
  'sales-journal', 'purchase-journal', 'cash-receipt-journal', 'cash-disbursement-journal', 'receivable-schedule', 'receivable-aging', 'payable-schedule', 'payable-aging',
  'customers', 'sales-payment-terms', 'sales-payment-methods', 'sales-discount-types', 'vendors', 'revolving-fund-customers', 'purchases-discount-types', 'purchases-payment-terms', 'purchases-payment-methods', 'bank-accounts', 'bank-transactions', 'fixed-assets',
  'form-2550m', 'form-0619e', 'form-0619f', 'form-1601c', 'form-1600vt', 'form-2550q', 'form-1702q', 'form-1601eq', 'form-1601fq', 'form-1604c', 'form-1604e', 'form-1604f', 'form-1702rt', 'form-0605', 'form-2306', 'form-2307',
  'analytics-assets', 'analytics-liabilities', 'analytics-equities', 'analytics-revenues', 'analytics-expenses', 'company-profile', 'company-owners', 'company-registration',
  'company-recording', 'company-reporting', 'company-tax-rules', 'users', 'roles', 'goods', 'services', 'other-items', 'series', 'message-templates', 'report-templates', 'audit-trail'])

connectedPages.add('documents')
connectedPages.add('bir-books')
connectedPages.add('summary-of-sales')
connectedPages.add('revolving-fund-logs')

export function resolveWorkspace(_search: string, configuredBaseUrl: string, development: boolean, demonstration = false) {
  const baseUrl = configuredBaseUrl.trim().replace(/\/+$/, '') || (development ? '/vps-api' : '')
  const connectedAvailable = !demonstration
  const mode: WorkspaceMode = demonstration ? 'preview' : 'connected'
  return { mode, connectedAvailable, baseUrl: mode === 'connected' ? baseUrl : '' }
}

export const isConnectedResource = (resource: string) => connectedResources.has(resource)
export const isConnectedPage = (pageId: string) => connectedPages.has(pageId)

export function cleanWorkspaceUrl(href: string) {
  const url = new URL(href)
  url.searchParams.delete('mode')
  return url.href
}
