import { ref, watch } from 'vue'
import { z } from 'zod'
import { fiscalYearStartMonth } from '../../company/companyStore'
import { presetRange, todayIso, type IsoRange, type PeriodPreset } from './reportPeriods'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose both dates.')
const rangeSchema = z.object({ from: isoDate, to: isoDate })
  .refine((range) => range.from <= range.to, { message: 'The end date must be on or after the start date.' })

/** Draft period controls plus the range last applied with Generate. */
export function usePeriodFilter(initial: Exclude<PeriodPreset, 'custom'> = 'year-to-date') {
  const start = presetRange(initial, todayIso(), fiscalYearStartMonth.value)
  const preset = ref<PeriodPreset>(initial)
  const from = ref(start.from)
  const to = ref(start.to)
  const applied = ref<IsoRange>({ ...start })
  const error = ref('')
  const rangeFor = (value: Exclude<PeriodPreset, 'custom'>) => presetRange(value, todayIso(), fiscalYearStartMonth.value)

  watch(preset, (value) => {
    if (value === 'custom') return
    const range = rangeFor(value)
    from.value = range.from
    to.value = range.to
  })
  // Editing a date by hand turns the preset into a custom range.
  watch([from, to], () => {
    if (preset.value === 'custom') return
    const range = rangeFor(preset.value)
    if (range.from !== from.value || range.to !== to.value) preset.value = 'custom'
  })

  function apply(): boolean {
    const result = rangeSchema.safeParse({ from: from.value, to: to.value })
    if (!result.success) {
      error.value = result.error.issues[0]?.message ?? 'Check the date range.'
      return false
    }
    error.value = ''
    applied.value = result.data
    return true
  }

  return { preset, from, to, applied, error, apply }
}

export type PeriodFilter = ReturnType<typeof usePeriodFilter>
