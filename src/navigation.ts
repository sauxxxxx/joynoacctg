import type { Component } from 'vue'
import {
  BarChart3,
  BookOpen,
  Building2,
  CircleDollarSign,
  CreditCard,
  FileBarChart2,
  FileCheck2,
  FileClock,
  FileSpreadsheet,
  FileText,
  FolderClosed,
  Landmark,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  UsersRound,
  Wallet,
} from '@lucide/vue'

export interface NavigationItem {
  id: string
  label: string
  icon?: Component
  children?: NavigationItem[]
}

export interface NavigationResult {
  id: string
  label: string
  path: string[]
  icon?: Component
}

const group = (id: string, label: string, children: NavigationItem[], icon: Component = FolderClosed): NavigationItem => ({
  id,
  label,
  icon,
  children,
})

const page = (id: string, label: string, icon: Component = FileText): NavigationItem => ({ id, label, icon })

export const navigation: NavigationItem[] = [
  page('dashboard', 'Dashboard', LayoutDashboard),
  group('assets', 'Asset Management', [
    page('fixed-assets', 'Fixed Assets', Package),
  ], Package),
  group('sales', 'Sales', [
    page('sales-invoices', 'Invoices', ReceiptText),
    group('sales-collections', 'Collections', [
      page('sales-receipts', 'Receipts', FileCheck2),
      page('acknowledgement-receipts', 'Acknowledgement Receipts', FileCheck2),
    ]),
    group('sales-setup', 'Setup', [
      page('customers', 'Customers', UsersRound),
      page('sales-payment-terms', 'Payment Terms', FileClock),
      page('sales-payment-methods', 'Payment Methods', CreditCard),
      page('sales-discount-types', 'Discount Types', CircleDollarSign),
    ], Settings2),
    group('sales-reports', 'Reports', [
      page('receivable-schedule', 'Receivable Schedule', FileBarChart2),
      page('receivable-aging', 'Receivable Aging', FileBarChart2),
    ], FileBarChart2),
  ], CircleDollarSign),
  group('purchases', 'Purchases', [
    group('payables', 'Payables', [
      page('purchase-invoices', 'Invoices', ReceiptText),
      page('payrolls', 'Payrolls', FileSpreadsheet),
    ]),
    group('payments', 'Payments', [
      group('vouchers', 'Vouchers', [
        page('cash-voucher', 'Cash Vouchers', FileCheck2),
        page('check-voucher', 'Check Vouchers', FileCheck2),
        page('petty-cash-voucher', 'Petty Cash Vouchers', FileCheck2),
      ]),
      group('purchase-receipts-group', 'Receipts', [
        page('purchase-receipts', 'Receipts', ReceiptText),
      ]),
    ], Wallet),
    group('purchases-setup', 'Setup', [
      page('vendors', 'Vendors', UsersRound),
      page('revolving-fund-customers', 'Revolving Fund Custodians', UsersRound),
      page('purchases-discount-types', 'Discount Types', CircleDollarSign),
      page('purchases-payment-terms', 'Payment Terms', FileClock),
      page('purchases-payment-methods', 'Payment Methods', CreditCard),
    ], Settings2),
    group('purchases-reports', 'Reports', [
      page('payable-schedule', 'Payable Schedule', FileBarChart2),
      page('payable-aging', 'Payable Aging', FileBarChart2),
      page('revolving-fund-logs', 'Revolving Fund Logs', FileBarChart2),
    ], FileBarChart2),
  ], ShoppingCart),
  group('accounting', 'Accounting', [
    group('journal-entries', 'Journal Entries', [
      page('general-journal', 'General Journal', BookOpen),
      page('sales-journal', 'Sales Journal', BookOpen),
      page('purchase-journal', 'Purchase Journal', BookOpen),
      page('cash-receipt-journal', 'Cash Receipt Journal', BookOpen),
      page('cash-disbursement-journal', 'Cash Disbursement Journal', BookOpen),
    ], BookOpen),
    group('accounting-setup', 'Setup', [
      page('chart-of-accounts', 'Chart of Accounts', FileSpreadsheet),
      page('account-categories', 'Account Categories', FileSpreadsheet),
    ], Settings2),
    group('accounting-reports', 'Reports', [
      page('general-ledger', 'General Ledger (Detailed)', FileBarChart2),
      page('trial-balance', 'Trial Balance', FileBarChart2),
      group('income-statement', 'Income Statement', [
        page('income-statement-annual', 'Annual', FileBarChart2),
        page('income-statement-annual-simple', 'Annual (Simplified)', FileBarChart2),
        page('income-statement-monthly-simple', 'Monthly (Simplified)', FileBarChart2),
      ], FileBarChart2),
      page('summary-of-sales', 'Summary of Sales', FileBarChart2),
      page('balance-sheet', 'Balance Sheet', FileBarChart2),
    ], FileBarChart2),
    group('analytics', 'Analytics', [
      page('analytics-assets', 'Assets', BarChart3),
      page('analytics-liabilities', 'Liabilities', BarChart3),
      page('analytics-equities', 'Equities', BarChart3),
      page('analytics-revenues', 'Revenues', BarChart3),
      page('analytics-expenses', 'Expenses', BarChart3),
    ], BarChart3),
  ], FileSpreadsheet),
  group('government', 'Government', [
    group('tax-management', 'Tax Management', [
      group('monthly-forms', 'Monthly', [
        page('form-2550m', '2550M'),
        page('form-0619e', '0619-E'),
        page('form-0619f', '0619-F'),
        page('form-1601c', '1601-C'),
        page('form-1600vt', '1600-VT'),
        page('bir-books', 'BIR Books', BookOpen),
      ]),
      group('quarterly-forms', 'Quarterly', [
        page('form-2550q', '2550Q'),
        page('form-1702q', '1702Q'),
        page('form-1601eq', '1601EQ'),
        page('form-1601fq', '1601FQ'),
      ]),
      group('yearly-forms', 'Yearly', [
        page('form-1604c', '1604-C'),
        page('form-1604e', '1604-E'),
        page('form-1604f', '1604-F'),
        page('form-1702rt', '1702RT'),
        page('form-0605', '0605'),
      ]),
      group('other-forms', 'Others', [
        page('form-2306', '2306'),
        page('form-2307', '2307'),
      ]),
    ], FileSpreadsheet),
  ], Landmark),
  group('banking', 'Banking', [
    page('bank-accounts', 'Bank Accounts', Landmark),
    page('bank-transactions', 'Bank Transactions', CreditCard),
  ], Landmark),
  group('company', 'Company', [
    page('company-profile', 'Profile', Building2),
    page('company-owners', 'Owners', UsersRound),
    page('company-registration', 'Registration', FileCheck2),
    page('company-recording', 'Recording', FileText),
    page('company-reporting', 'Reporting', FileBarChart2),
    page('company-tax-rules', 'Tax Rules', FileSpreadsheet),
    group('user-accounts', 'User Accounts', [
      page('users', 'Users', UsersRound),
      page('roles', 'Roles', ShieldCheck),
    ], UsersRound),
    group('items', 'Items', [
      page('goods', 'Goods', Package),
      page('services', 'Services', Settings2),
      page('other-items', 'Others', Package),
    ], Package),
    page('message-templates', 'Message Templates', FileText),
    page('series', 'Series', FileSpreadsheet),
    group('company-reports', 'Reports', [
      page('report-templates', 'Templates', FileText),
      page('audit-trail', 'Audit Trail', FileClock),
    ], FileBarChart2),
    page('add-ons', 'Add-ons', Settings2),
  ], Building2),
  page('documents', 'Documents', FileText),
]

export function findAncestorIds(id: string): string[] {
  function search(items: NavigationItem[], ancestors: string[]): string[] | undefined {
    for (const item of items) {
      if (item.id === id) return ancestors
      const result = item.children && search(item.children, [...ancestors, item.id])
      if (result) return result
    }
  }
  return search(navigation, []) ?? []
}

export function findPage(id: string): NavigationResult | undefined {
  function search(items: NavigationItem[], path: string[]): NavigationResult | undefined {
    for (const item of items) {
      const nextPath = [...path, item.label]
      if (item.id === id) return { id, label: item.label, path: nextPath, icon: item.icon }
      const result = item.children && search(item.children, nextPath)
      if (result) return result
    }
  }

  return search(navigation, [])
}

export function searchPages(query: string): NavigationResult[] {
  const normalized = query.trim().toLocaleLowerCase()
  if (!normalized) return []

  const results: NavigationResult[] = []
  function visit(items: NavigationItem[], path: string[]) {
    for (const item of items) {
      const nextPath = [...path, item.label]
      if (item.children) visit(item.children, nextPath)
      else if (nextPath.join(' ').toLocaleLowerCase().includes(normalized)) {
        results.push({ id: item.id, label: item.label, path: nextPath, icon: item.icon })
      }
    }
  }
  visit(navigation, [])
  return results
}
