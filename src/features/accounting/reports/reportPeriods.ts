import { toIsoDate } from '../../../components/ui/dateUtils'

export type PeriodPreset = 'this-month' | 'last-month' | 'this-quarter' | 'year-to-date' | 'this-year' | 'last-year' | 'custom'

export interface IsoRange {
  from: string
  to: string
}

const monthNames = new Intl.DateTimeFormat('en-PH', { month: 'short' })
const longDate = new Intl.DateTimeFormat('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })

export function todayIso(): string {
  return toIsoDate(new Date())
}

export function parseIso(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function formatLongDate(value: string): string {
  return longDate.format(parseIso(value))
}

export function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(parseIso(value))
}

export function monthKey(year: number, monthIndex: number): string {
  const date = new Date(year, monthIndex, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

export function monthLabel(month: string, withYear = false): string {
  const date = parseIso(`${month}-01`)
  return withYear ? `${monthNames.format(date)} ${date.getFullYear()}` : monthNames.format(date)
}

/** `count` consecutive months ending with the month of `endIso`, oldest first. */
export function monthsEnding(endIso: string, count: number): string[] {
  const end = parseIso(endIso)
  return Array.from({ length: count }, (_, index) => monthKey(end.getFullYear(), end.getMonth() - (count - 1 - index)))
}

/** Twelve months of a fiscal year that starts in `startMonth` (1–12) of `year`. */
export function fiscalYearMonths(year: number, startMonth: number): string[] {
  return Array.from({ length: 12 }, (_, index) => monthKey(year, startMonth - 1 + index))
}

/** Calendar year in which the fiscal year containing `date` starts. */
export function fiscalYearStartYear(date: Date, startMonth: number): number {
  return date.getMonth() + 1 >= startMonth ? date.getFullYear() : date.getFullYear() - 1
}

function lastDay(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex + 1, 0)
}

export function presetRange(preset: Exclude<PeriodPreset, 'custom'>, todayValue: string, fiscalStartMonth = 1): IsoRange {
  const today = parseIso(todayValue)
  const year = today.getFullYear()
  const month = today.getMonth()
  const fiscalYear = fiscalYearStartYear(today, fiscalStartMonth)
  switch (preset) {
    case 'this-month': return { from: toIsoDate(new Date(year, month, 1)), to: toIsoDate(lastDay(year, month)) }
    case 'last-month': return { from: toIsoDate(new Date(year, month - 1, 1)), to: toIsoDate(lastDay(year, month - 1)) }
    case 'this-quarter': {
      const start = month - (month % 3)
      return { from: toIsoDate(new Date(year, start, 1)), to: toIsoDate(lastDay(year, start + 2)) }
    }
    case 'year-to-date': return { from: toIsoDate(new Date(fiscalYear, fiscalStartMonth - 1, 1)), to: todayValue }
    case 'this-year': return { from: toIsoDate(new Date(fiscalYear, fiscalStartMonth - 1, 1)), to: toIsoDate(lastDay(fiscalYear, fiscalStartMonth + 10)) }
    case 'last-year': return { from: toIsoDate(new Date(fiscalYear - 1, fiscalStartMonth - 1, 1)), to: toIsoDate(lastDay(fiscalYear - 1, fiscalStartMonth + 10)) }
  }
}

/** Named ranges for the date filter's Period list. */
export function periodPresets(todayValue: string, fiscalStartMonth: number): { value: PeriodPreset; label: string; range: IsoRange }[] {
  const fiscal = fiscalStartMonth !== 1
  const labels: [Exclude<PeriodPreset, 'custom'>, string][] = [
    ['this-month', 'This month'],
    ['last-month', 'Last month'],
    ['this-quarter', 'This quarter'],
    ['year-to-date', fiscal ? 'Fiscal year to date' : 'Year to date'],
    ['this-year', fiscal ? 'This fiscal year' : 'This year'],
    ['last-year', fiscal ? 'Last fiscal year' : 'Last year'],
  ]
  return labels.map(([value, label]) => ({ value, label, range: presetRange(value, todayValue, fiscalStartMonth) }))
}

export function describeRange(range: IsoRange): string {
  return `${formatLongDate(range.from)} to ${formatLongDate(range.to)}`
}
