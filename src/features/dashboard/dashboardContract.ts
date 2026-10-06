export interface DashboardMetric {
  label: string
  valueCents: number
  detail: string
}

export interface DashboardTrendPoint {
  month: string
  revenueCents: number
  expenseCents: number
}

export interface DashboardDeadline {
  id: string
  form: string
  dueDate: string
  detail: string
}

export interface DashboardActivity {
  id: string
  at: string
  action: string
  reference: string
  module: string
}

export interface DashboardSnapshot {
  companyName: string
  sourceLabel: string
  bankBalanceCents: number | null
  receivablesCents: number | null
  payablesCents: number | null
  revenueCents: number
  expensesCents: number
  unjournalizedCount: number
  trends: DashboardTrendPoint[]
  deadlines: DashboardDeadline[]
  activities: DashboardActivity[]
}

export interface DashboardService {
  load(): Promise<DashboardSnapshot>
}
