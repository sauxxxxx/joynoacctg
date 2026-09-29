export const accountingReportPageIds = [
  'general-ledger',
  'trial-balance',
  'income-statement-annual',
  'income-statement-annual-simple',
  'income-statement-monthly-simple',
  'summary-of-sales',
  'balance-sheet',
] as const

export type AccountingReportPageId = typeof accountingReportPageIds[number]

export const analyticsPageIds = ['analytics-assets', 'analytics-liabilities', 'analytics-equities', 'analytics-revenues', 'analytics-expenses'] as const

export type AnalyticsPageId = typeof analyticsPageIds[number]

export function asPageId<T extends string>(ids: readonly T[], id: string): T | undefined {
  return ids.find((item) => item === id)
}
