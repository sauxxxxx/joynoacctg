import { computed, ref, watch } from 'vue'
import { fiscalYearStartMonth } from '../../company/companyStore'
import { periodPresets, presetRange, todayIso, type IsoRange, type PeriodPreset } from './reportPeriods'

/** Applied report period plus the default and presets the date filter offers. */
export function useReportPeriod(initial: Exclude<PeriodPreset, 'custom'>) {
  const today = todayIso()
  const defaultRange = computed(() => presetRange(initial, today, fiscalYearStartMonth.value))
  const range = ref<IsoRange>({ ...defaultRange.value })
  watch(defaultRange, (next, previous) => {
    if (range.value.from === previous.from && range.value.to === previous.to) range.value = { ...next }
  })
  const presets = computed(() => periodPresets(today, fiscalYearStartMonth.value))
  return { range, defaultRange, presets }
}

/** Applied as-of date, kept in the date filter's `{ from, to }` shape. */
export function useAsOfDate() {
  const defaultRange: IsoRange = { from: '', to: todayIso() }
  const range = ref<IsoRange>({ ...defaultRange })
  return { range, defaultRange, asOf: computed(() => range.value.to) }
}
