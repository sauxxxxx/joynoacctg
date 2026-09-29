<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { CalendarDays } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import './workspace.css'

/**
 * Calendar button with a date-range popover, matching the Purchase Journal filter:
 * edit dates, then Apply dates or Reset. Outside click and Escape close it.
 */
export interface DateRange {
  from: string
  to: string
}

export interface DatePreset {
  value: string
  label: string
  range: DateRange
}

const props = withDefaults(defineProps<{
  modelValue: DateRange
  /** Range Reset returns to. */
  defaultValue: DateRange
  /** `as-of` edits only `to`. */
  mode?: 'range' | 'as-of'
  /** Allows blank dates, meaning no limit on that side. */
  optional?: boolean
  presets?: DatePreset[]
  max?: string
}>(), { mode: 'range', optional: false, presets: () => [] })
const emit = defineEmits<{ 'update:modelValue': [value: DateRange] }>()

const uid = useId()
const open = ref(false)
const draft = ref<DateRange>({ ...props.modelValue })
const error = ref('')
const root = ref<HTMLElement | null>(null)
const toggle = ref<HTMLButtonElement | null>(null)
const isAsOf = computed(() => props.mode === 'as-of')
const heading = computed(() => isAsOf.value ? 'As of date' : 'Date range')
const active = computed(() => Boolean(props.modelValue.from || props.modelValue.to))

const formatter = new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
const show = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return formatter.format(new Date(year, month - 1, day))
}
const summary = computed(() => {
  const { from, to } = props.modelValue
  if (isAsOf.value) return to ? `As of ${show(to)}` : 'Choose an as-of date'
  if (from && to) return `${show(from)} to ${show(to)}`
  if (from) return `From ${show(from)}`
  if (to) return `Up to ${show(to)}`
  return 'All dates'
})

const presetOptions = computed(() => [...props.presets.map(({ value, label }) => ({ value, label })), { value: 'custom', label: 'Custom range' }])
const preset = computed({
  get: () => props.presets.find((item) => item.range.from === draft.value.from && item.range.to === draft.value.to)?.value ?? 'custom',
  set: (value: string) => {
    const match = props.presets.find((item) => item.value === value)
    if (match) draft.value = { ...match.range }
  },
})

const isIso = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)

function validate({ from, to }: DateRange): string {
  if (isAsOf.value) return props.optional || isIso(to) ? '' : 'Choose an as-of date.'
  if (!props.optional && !isIso(from)) return 'Choose a valid start date.'
  if (!props.optional && !isIso(to)) return 'Choose a valid end date.'
  if (from && to && from > to) return 'The end date must be on or after the start date.'
  return ''
}

function openPanel() {
  draft.value = { ...props.modelValue }
  error.value = ''
  open.value = !open.value
}

function close(focus = true) {
  open.value = false
  if (focus) nextTick(() => toggle.value?.focus())
}

function apply() {
  error.value = validate(draft.value)
  if (error.value) return
  emit('update:modelValue', { from: isAsOf.value ? '' : draft.value.from, to: draft.value.to })
  close()
}

function reset() {
  error.value = ''
  emit('update:modelValue', { ...props.defaultValue })
  close()
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target
  if (!open.value || !(target instanceof Node)) return
  if (root.value?.contains(target)) return
  // The calendar renders outside this element so narrow panels do not clip it.
  if (target instanceof Element && target.closest('.ui-date-picker__panel')) return
  close(false)
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) close()
}

onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="ws-date-control">
    <button
      ref="toggle"
      class="ws-button ws-date-control__toggle"
      type="button"
      :aria-expanded="open"
      :aria-controls="`${uid}-panel`"
      :aria-label="`${heading}: ${summary}`"
      :title="summary"
      @click="openPanel"
    >
      <CalendarDays :size="17" aria-hidden="true" />
      <span v-if="active" class="ws-date-control__indicator" aria-hidden="true" />
    </button>
    <div v-if="open" :id="`${uid}-panel`" class="ws-date-filter" role="group" :aria-label="`${heading} filter`">
      <div class="ws-date-filter__heading"><CalendarDays :size="17" aria-hidden="true" /><h2>{{ heading }}</h2></div>
      <form novalidate @submit.prevent="apply">
        <AppSelect v-if="presets.length && !isAsOf" :id="`${uid}-preset`" v-model="preset" label="Period" :options="presetOptions" />
        <AppDatePicker v-if="!isAsOf" :id="`${uid}-from`" v-model="draft.from" label="From" :required="!optional" :invalid="Boolean(error)" :max="max" />
        <AppDatePicker :id="`${uid}-to`" v-model="draft.to" :label="isAsOf ? 'As of' : 'To'" :required="!optional" :invalid="Boolean(error)" :max="max" />
        <p v-if="error" class="ws-date-filter__error" role="alert">{{ error }}</p>
        <div class="ws-date-filter__actions">
          <button class="ws-button" type="button" @click="reset">Reset</button>
          <button class="ws-button ws-button--primary" type="submit">Apply dates</button>
        </div>
      </form>
    </div>
  </div>
</template>
