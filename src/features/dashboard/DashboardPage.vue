<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { AlertCircle, ArrowRight, CalendarDays, FileClock, Landmark, RefreshCw, Scale, TrendingUp } from '@lucide/vue'
import { useAsyncResource } from '../../lib/asyncState'
import { formatMoney } from '../../lib/money'
import type { DashboardDeadline } from './dashboardContract'
import { http } from '../../services/api/httpClient'
import type { EntityResponseDto } from '../../contracts/dto'
import type { DashboardSnapshot } from './dashboardContract'
import './dashboard.css'

type CalendarCell = { key: string; day?: number; deadline?: DashboardDeadline }

const emit = defineEmits<{ navigate: [id: string] }>()
const resource = useAsyncResource({ load: async () => (await http.get<EntityResponseDto<DashboardSnapshot>>('/dashboard')).data })
const balanceLabel = (value: number | null) => value === null ? 'Not set up' : `₱${formatMoney(value)}`
const data = computed(() => resource.data.value)
const maxTrend = computed(() => Math.max(1, ...(data.value?.trends.flatMap((row) => [row.revenueCents, row.expenseCents]) ?? [1])))
const netResultCents = computed(() => (data.value?.revenueCents ?? 0) - (data.value?.expensesCents ?? 0))
const hasPerformance = computed(() => Boolean(data.value?.revenueCents || data.value?.expensesCents))
const revenueRatio = computed(() => {
  const revenue = Math.abs(data.value?.revenueCents ?? 0)
  const total = revenue + Math.abs(data.value?.expensesCents ?? 0)
  return total > 0 ? revenue / total * 100 : 0
})
const performanceStyle = computed(() => ({ '--revenue-width': `${revenueRatio.value}%` }))
const month = new Intl.DateTimeFormat('en-PH', { month: 'short' })
const fullMonth = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' })
const date = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })
const dateTime = new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const compactMoney = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 })
const monthLabel = (value: string) => month.format(new Date(`${value}-01T00:00:00`))
const dateLabel = (value: string) => date.format(new Date(`${value}T00:00:00`))
const activityDate = (value: string) => dateTime.format(new Date(value))
const axisLabel = (ratio: number) => `₱${compactMoney.format(maxTrend.value * ratio / 10_000)}`
const trendPeriod = computed(() => {
  const trends = data.value?.trends ?? []
  if (!trends.length) return 'No posted activity'
  return `${monthLabel(trends[0].month)} – ${monthLabel(trends.at(-1)?.month ?? trends[0].month)}`
})
const calendarMonthLabel = computed(() => {
  const firstDueDate = data.value?.deadlines[0]?.dueDate
  return firstDueDate ? fullMonth.format(new Date(`${firstDueDate}T00:00:00`)) : 'Upcoming filings'
})
const nextDeadline = computed(() => data.value?.deadlines[0])
const nextDeadlineCount = computed(() => {
  const first = nextDeadline.value
  if (!first) return 0
  return data.value?.deadlines.filter((item) => item.dueDate === first.dueDate).length ?? 0
})
const calendarCells = computed<CalendarCell[]>(() => {
  const deadlines = data.value?.deadlines ?? []
  const firstDueDate = deadlines[0]?.dueDate
  if (!firstDueDate) return []
  const [year, monthNumber] = firstDueDate.split('-').map(Number)
  const leadingDays = (new Date(year, monthNumber - 1, 1).getDay() + 6) % 7
  const totalDays = new Date(year, monthNumber, 0).getDate()
  const byDate = new Map(deadlines.map((deadline) => [deadline.dueDate, deadline]))
  const blanks = Array.from({ length: leadingDays }, (_, index) => ({ key: `blank-${index}` }))
  const days = Array.from({ length: totalDays }, (_, index) => {
    const day = index + 1
    const iso = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    return { key: iso, day, deadline: byDate.get(iso) }
  })
  return [...blanks, ...days]
})

onMounted(resource.run)
</script>

<template>
  <section class="dashboard" aria-label="Accounting dashboard">
    <div v-if="resource.loading.value" class="dashboard-state" role="status"><span class="ws-spinner" aria-hidden="true" />Loading your accounting overview…</div>
    <div v-else-if="resource.status.value === 'error'" class="dashboard-state dashboard-state--error" role="alert">
      <AlertCircle :size="22" aria-hidden="true" /><strong>Dashboard unavailable</strong><span>{{ resource.error.value }}</span>
      <button class="ws-button" type="button" @click="resource.run"><RefreshCw :size="15" /> Try again</button>
    </div>

    <template v-else-if="data">
      <header class="dashboard__intro">
        <div><h1>Overview</h1><p>{{ data.companyName }} · Posted accounting activity and upcoming work</p></div>
      </header>

      <div class="dashboard__hero-grid">
        <section class="dashboard-panel dashboard-panel--trend">
          <header class="dashboard-panel__header dashboard-panel__header--trend">
            <div><h2>Revenue and expenses</h2><p>Monthly posted performance · {{ trendPeriod }}</p></div>
            <button class="dashboard-link" type="button" @click="emit('navigate', 'income-statement-monthly-simple')">Income statement <ArrowRight :size="14" /></button>
          </header>

          <dl class="dashboard-summary">
            <div><dt>Revenue</dt><dd>₱{{ formatMoney(data.revenueCents) }}</dd></div>
            <div><dt>Expenses</dt><dd>₱{{ formatMoney(data.expensesCents) }}</dd></div>
            <div><dt>{{ netResultCents >= 0 ? 'Net income' : 'Net loss' }}</dt><dd :class="{ 'is-negative': netResultCents < 0 }">₱{{ formatMoney(Math.abs(netResultCents)) }}</dd></div>
          </dl>

          <div class="dashboard-chart" role="img" aria-label="Revenue and expenses for the last six posted months">
            <div class="dashboard-chart__axis" aria-hidden="true"><span>{{ axisLabel(100) }}</span><span>{{ axisLabel(50) }}</span><span>₱0</span></div>
            <div class="dashboard-chart__plot">
              <div class="dashboard-chart__gridlines" aria-hidden="true"><i /><i /><i /></div>
              <div v-for="point in data.trends" :key="point.month" class="dashboard-chart__column">
                <div class="dashboard-chart__bars"><span class="dashboard-chart__bar dashboard-chart__bar--revenue" :style="{ height: `${Math.max(3, point.revenueCents / maxTrend * 100)}%` }" :title="`${monthLabel(point.month)} revenue: ₱${formatMoney(point.revenueCents)}`" /><span class="dashboard-chart__bar dashboard-chart__bar--expense" :style="{ height: `${Math.max(3, point.expenseCents / maxTrend * 100)}%` }" :title="`${monthLabel(point.month)} expenses: ₱${formatMoney(point.expenseCents)}`" /></div>
                <span>{{ monthLabel(point.month) }}</span>
              </div>
            </div>
          </div>
          <footer class="dashboard-legend"><span><i class="dashboard-key dashboard-key--revenue" />Revenue</span><span><i class="dashboard-key dashboard-key--expense" />Expenses</span></footer>
        </section>

        <section class="dashboard-panel dashboard-panel--calendar">
          <header class="dashboard-panel__header"><div><h2>Tax calendar</h2><p>{{ calendarMonthLabel }}</p></div><CalendarDays :size="18" aria-hidden="true" /></header>
          <div v-if="calendarCells.length" class="dashboard-calendar" role="grid" :aria-label="`Tax deadlines for ${calendarMonthLabel}`">
            <span v-for="(weekday, index) in ['M', 'T', 'W', 'T', 'F', 'S', 'S']" :key="`${weekday}-${index}`" class="dashboard-calendar__weekday" role="columnheader">{{ weekday }}</span>
            <span v-for="cell in calendarCells" :key="cell.key" class="dashboard-calendar__day" :class="{ 'dashboard-calendar__day--due': cell.deadline, 'dashboard-calendar__day--blank': !cell.day }" role="gridcell" :title="cell.deadline ? `${cell.deadline.form}: ${cell.deadline.detail}` : undefined">{{ cell.day }}</span>
          </div>
          <div v-if="nextDeadline" class="dashboard-next-due"><span>Next deadline</span><strong>{{ dateLabel(nextDeadline.dueDate) }}</strong><small>{{ nextDeadlineCount > 1 ? `${nextDeadlineCount} forms due` : `${nextDeadline.form} · ${nextDeadline.detail}` }}</small></div>
          <button class="dashboard-link dashboard-link--footer" type="button" @click="emit('navigate', 'form-2550m')">Tax management <ArrowRight :size="14" /></button>
        </section>
      </div>

      <div class="dashboard__support-grid">
        <section class="dashboard-panel">
          <header class="dashboard-panel__header"><div><h2>Balance health</h2><p>Current posted position</p></div><Landmark :size="18" aria-hidden="true" /></header>
          <dl class="dashboard-balances">
            <div><dt><Landmark :size="15" />Cash</dt><dd>{{ balanceLabel(data.bankBalanceCents) }}</dd></div>
            <div><dt><TrendingUp :size="15" />Receivables</dt><dd>{{ balanceLabel(data.receivablesCents) }}</dd></div>
            <div><dt><Scale :size="15" />Payables</dt><dd>{{ balanceLabel(data.payablesCents) }}</dd></div>
            <div><dt><FileClock :size="15" />Draft journal entries</dt><dd>{{ data.unjournalizedCount }}</dd></div>
          </dl>
        </section>

        <section class="dashboard-panel dashboard-panel--performance">
          <header class="dashboard-panel__header"><div><h2>Operating result</h2><p>Income compared with expenses</p></div></header>
          <div class="dashboard-result"><span>{{ netResultCents >= 0 ? 'Net income' : 'Net loss' }}</span><strong :class="{ 'is-negative': netResultCents < 0 }">₱{{ formatMoney(Math.abs(netResultCents)) }}</strong><small>{{ hasPerformance ? `${Math.round(revenueRatio)}% of the absolute income and expense totals is revenue` : 'No posted income or expenses yet.' }}</small></div>
          <div v-if="hasPerformance" class="dashboard-performance" :style="performanceStyle" role="img" :aria-label="`Revenue ${Math.round(revenueRatio)} percent and expenses ${Math.round(100 - revenueRatio)} percent`"><span /><i /></div>
          <div v-if="hasPerformance" class="dashboard-performance__legend"><span><i class="dashboard-key dashboard-key--revenue" />Revenue<strong>{{ Math.round(revenueRatio) }}%</strong></span><span><i class="dashboard-key dashboard-key--expense" />Expenses<strong>{{ Math.round(100 - revenueRatio) }}%</strong></span></div>
        </section>

        <section class="dashboard-panel dashboard-panel--activity">
          <header class="dashboard-panel__header"><div><h2>Recent activity</h2><p>Latest recorded changes</p></div></header>
          <ul v-if="data.activities.length" class="dashboard-activity"><li v-for="activity in data.activities.slice(0, 4)" :key="activity.id"><span class="dashboard-activity__mark" /><span><strong>{{ activity.action }} · {{ activity.reference }}</strong><small>{{ activity.module }} · {{ activityDate(activity.at) }}</small></span></li></ul>
          <div v-else class="dashboard-panel__empty">No activity has been recorded yet.</div>
          <button class="dashboard-link dashboard-link--footer" type="button" @click="emit('navigate', 'audit-trail')">Audit trail <ArrowRight :size="14" /></button>
        </section>
      </div>
    </template>
  </section>
</template>
