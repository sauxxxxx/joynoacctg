<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from '@lucide/vue'
import AppSelect from './AppSelect.vue'
import { parseIsoDate, shiftDateMonth, toIsoDate } from './dateUtils'
import './controls.css'

const props = defineProps<{
  modelValue: string
  label: string
  id?: string
  required?: boolean
  invalid?: boolean
  describedBy?: string
  disabled?: boolean
  min?: string
  max?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = props.id ?? useId()
const panelId = `${uid}-calendar`
const labelId = `${uid}-label`
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const panelHost = ref<HTMLElement | string>('body')
const open = ref(false)
const view = ref(new Date())
const focusedIso = ref('')
const panelPosition = ref({ top: '0px', left: '0px' })
const monthOptions = Array.from({ length: 12 }, (_, month) => ({
  value: String(month),
  label: new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2024, month, 1)),
}))
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const selectedDate = computed(() => parseIsoDate(props.modelValue))
const displayValue = computed(() => selectedDate.value
  ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(selectedDate.value)
  : 'Choose date')
const spokenValue = computed(() => selectedDate.value
  ? new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(selectedDate.value)
  : 'No date selected')
const todayIso = toIsoDate(new Date())

const days = computed(() => {
  const first = new Date(view.value.getFullYear(), view.value.getMonth(), 1)
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index)
    return { iso: toIsoDate(date), day: date.getDate(), current: date.getMonth() === view.value.getMonth() }
  })
})

function allowed(iso: string) {
  return (!props.min || iso >= props.min) && (!props.max || iso <= props.max)
}

function canShift(amount: number) {
  const target = new Date(view.value.getFullYear(), view.value.getMonth() + amount, 1)
  const month = toIsoDate(target).slice(0, 7)
  return (!props.min || month >= props.min.slice(0, 7)) && (!props.max || month <= props.max.slice(0, 7))
}

function positionPanel() {
  if (!open.value || !trigger.value || !panel.value) return
  const anchor = trigger.value.getBoundingClientRect()
  const width = panel.value.offsetWidth
  const height = panel.value.offsetHeight
  let left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8))
  let top = Math.max(8, Math.min(anchor.top, window.innerHeight - height - 8))
  if (anchor.bottom + height + 6 <= window.innerHeight) top = anchor.bottom + 6
  else if (anchor.right + width + 6 <= window.innerWidth) left = anchor.right + 6
  else if (anchor.left - width - 6 >= 8) left = anchor.left - width - 6
  else if (anchor.top - height - 6 >= 8) top = anchor.top - height - 6
  panelPosition.value = { top: `${top}px`, left: `${left}px` }
}

function focusDay() {
  nextTick(() => panel.value?.querySelector<HTMLButtonElement>(`[data-date="${focusedIso.value}"]`)?.focus())
}

function show() {
  if (props.disabled) return
  panelHost.value = root.value?.closest('dialog') ?? 'body'
  const initial = selectedDate.value ?? new Date()
  const iso = toIsoDate(initial)
  focusedIso.value = allowed(iso) ? iso : (props.min ?? props.max ?? todayIso)
  const focused = parseIsoDate(focusedIso.value) ?? initial
  view.value = new Date(focused.getFullYear(), focused.getMonth(), 1)
  open.value = true
  nextTick(() => { positionPanel(); focusDay() })
}

function close(restoreFocus = false) {
  open.value = false
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function select(iso: string) {
  if (!allowed(iso)) return
  emit('update:modelValue', iso)
  close(true)
}

function shiftView(amount: number) {
  if (!canShift(amount)) return
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + amount, 1)
}

function setMonth(value: string) {
  const month = Number(value)
  const target = new Date(view.value.getFullYear(), month, 1)
  const targetMonth = toIsoDate(target).slice(0, 7)
  if ((!props.min || targetMonth >= props.min.slice(0, 7)) && (!props.max || targetMonth <= props.max.slice(0, 7))) view.value = target
}

function onDayKeydown(event: KeyboardEvent, iso: string) {
  const current = parseIsoDate(iso)
  if (!current) return
  let target: Date | null = null
  if (event.key === 'ArrowLeft') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 1)
  if (event.key === 'ArrowRight') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 1)
  if (event.key === 'ArrowUp') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7)
  if (event.key === 'ArrowDown') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7)
  if (event.key === 'Home') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() - current.getDay())
  if (event.key === 'End') target = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 6 - current.getDay())
  if (event.key === 'PageUp') target = shiftDateMonth(current, event.ctrlKey ? -12 : -1)
  if (event.key === 'PageDown') target = shiftDateMonth(current, event.ctrlKey ? 12 : 1)
  if (!target) return
  event.preventDefault()
  const nextIso = toIsoDate(target)
  if (!allowed(nextIso)) return
  focusedIso.value = nextIso
  view.value = new Date(target.getFullYear(), target.getMonth(), 1)
  focusDay()
}

function onOutsidePointer(event: PointerEvent) {
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !panel.value?.contains(target)) close()
}

function onOutsideFocus(event: FocusEvent) {
  const target = event.target as Node
  if (open.value && !root.value?.contains(target) && !panel.value?.contains(target)) close()
}

function onEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return
  event.preventDefault()
  event.stopPropagation()
  close(true)
}

watch(() => props.modelValue, (value) => {
  if (open.value) return
  const date = parseIsoDate(value)
  if (date) view.value = new Date(date.getFullYear(), date.getMonth(), 1)
})
onMounted(() => {
  document.addEventListener('pointerdown', onOutsidePointer)
  document.addEventListener('focusin', onOutsideFocus)
  window.addEventListener('resize', positionPanel)
  window.addEventListener('scroll', positionPanel, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onOutsidePointer)
  document.removeEventListener('focusin', onOutsideFocus)
  window.removeEventListener('resize', positionPanel)
  window.removeEventListener('scroll', positionPanel, true)
})
</script>

<template>
  <div ref="root" class="ui-date-picker">
    <span :id="labelId" class="ui-control-label">{{ label }}<span v-if="required" aria-hidden="true"> *</span></span>
    <button :id="uid" ref="trigger" type="button" class="ui-control-trigger ui-date-picker__trigger"
      :aria-labelledby="labelId" :aria-description="spokenValue" :aria-expanded="open" :aria-controls="panelId"
      :aria-required="required || undefined" :aria-invalid="invalid || undefined" :aria-describedby="describedBy" :disabled="disabled"
      @click="open ? close() : show()" @keydown="onEscape"
    >
      <span :class="{ 'ui-date-picker__placeholder': !selectedDate }">{{ displayValue }}</span>
      <CalendarDays :size="16" aria-hidden="true" />
    </button>
    <Teleport :to="panelHost">
      <div v-if="open" :id="panelId" ref="panel" class="ui-date-picker__panel" role="dialog"
        :aria-label="`Choose date for ${label}`" :style="panelPosition" @keydown="onEscape">
        <div class="ui-date-picker__header">
          <button type="button" aria-label="Previous year" :disabled="!canShift(-12)" @click="shiftView(-12)"><ChevronsLeft :size="16" /></button>
          <button type="button" aria-label="Previous month" :disabled="!canShift(-1)" @click="shiftView(-1)"><ChevronLeft :size="16" /></button>
          <AppSelect :id="`${uid}-month`" aria-label="Month" :model-value="String(view.getMonth())" :options="monthOptions" compact @update:model-value="setMonth" />
          <span class="ui-date-picker__year">{{ view.getFullYear() }}</span>
          <button type="button" aria-label="Next month" :disabled="!canShift(1)" @click="shiftView(1)"><ChevronRight :size="16" /></button>
          <button type="button" aria-label="Next year" :disabled="!canShift(12)" @click="shiftView(12)"><ChevronsRight :size="16" /></button>
        </div>
        <div class="ui-date-picker__grid" role="group" :aria-label="new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(view)">
          <span v-for="weekday in weekdays" :key="weekday" class="ui-date-picker__weekday" aria-hidden="true">{{ weekday }}</span>
          <button v-for="day in days" :key="day.iso" type="button" class="ui-date-picker__day"
            :class="{ 'ui-date-picker__day--outside': !day.current, 'ui-date-picker__day--selected': day.iso === modelValue, 'ui-date-picker__day--today': day.iso === todayIso }"
            :data-date="day.iso" :aria-label="new Intl.DateTimeFormat('en-US', { dateStyle: 'full' }).format(parseIsoDate(day.iso)!)"
            :aria-selected="day.iso === modelValue" :aria-current="day.iso === todayIso ? 'date' : undefined"
            :tabindex="day.iso === focusedIso ? 0 : -1" :disabled="!allowed(day.iso)"
            @click="select(day.iso)" @keydown="onDayKeydown($event, day.iso)"
          >{{ day.day }}</button>
        </div>
        <div class="ui-date-picker__footer">
          <button v-if="!required" type="button" @click="emit('update:modelValue', ''); close(true)">Clear</button>
          <button type="button" :disabled="!allowed(todayIso)" @click="select(todayIso)">Today</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
