import { computed, ref } from 'vue'
import { fiscalYearStartMonth } from '../../company/companyStore'
import { periodPresets, presetRange, todayIso, type IsoRange, type PeriodPreset } from './reportPeriods'

/** Applied report period plus the default and presets the date filter offers. */
export function useReportPeriod(initial: Exclude<PeriodPreset, 'custom'>) {
  const today = todayIso()
  const defaultRange = presetRange(initial, today, fiscalYearStartMonth.value)
  const range = ref<IsoRange>({ ...defaultRange })
  const presets = computed(() => periodPresets(today, fiscalYearStartMonth.value))
  return { range, defaultRange, presets }
}

/** Applied as-of date, kept in the date filter's `{ from, to }` shape. */
export function useAsOfDate() {
  const defaultRange: IsoRange = { from: '', to: todayIso() }
  const range = ref<IsoRange>({ ...defaultRange })
  return { range, defaultRange, asOf: computed(() => range.value.to) }
}
