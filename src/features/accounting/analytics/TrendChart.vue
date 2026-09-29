<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { compactMoney, money } from '../reports/reportFormat'

/** Single-series trend: a 2px line with a light area wash, or columns. Values are centavos. */
const props = defineProps<{
  labels: string[]
  values: number[]
  kind: 'line' | 'column'
  seriesName: string
}>()

const container = ref<HTMLElement | null>(null)
const width = ref(640)
const height = 260
const pad = { top: 16, right: 16, bottom: 30, left: 64 }
const active = ref<number | null>(null)
let observer: ResizeObserver | null = null

onMounted(() => {
  if (!container.value) return
  width.value = container.value.clientWidth || 640
  observer = new ResizeObserver(([entry]) => { width.value = Math.max(280, entry.contentRect.width) })
  observer.observe(container.value)
})
onBeforeUnmount(() => observer?.disconnect())

function niceStep(range: number, targetTicks: number): number {
  const raw = range / targetTicks
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10) * magnitude
}

const scale = computed(() => {
  const min = Math.min(0, ...props.values)
  const max = Math.max(0, ...props.values)
  const step = niceStep(max - min || 100_000, 4)
  const lo = Math.floor(min / step) * step
  const hi = Math.max(Math.ceil(max / step) * step, lo + step)
  const ticks: number[] = []
  for (let value = lo; value <= hi + step / 2; value += step) ticks.push(value)
  const plotHeight = height - pad.top - pad.bottom
  const y = (value: number) => pad.top + (hi - value) / (hi - lo) * plotHeight
  return { ticks, y }
})

const plotWidth = computed(() => width.value - pad.left - pad.right)
const band = computed(() => plotWidth.value / Math.max(props.values.length, 1))
const xCenter = (index: number) => pad.left + band.value * (index + .5)

const linePath = computed(() => props.values.map((value, index) => `${index ? 'L' : 'M'}${xCenter(index).toFixed(1)},${scale.value.y(value).toFixed(1)}`).join(''))
const areaPath = computed(() => {
  if (!props.values.length) return ''
  const base = scale.value.y(0).toFixed(1)
  return `${linePath.value}L${xCenter(props.values.length - 1).toFixed(1)},${base}L${xCenter(0).toFixed(1)},${base}Z`
})

/** Column with a 4px rounded data end and a square baseline end. */
function columnPath(index: number): string {
  const value = props.values[index]
  const barWidth = Math.min(24, band.value * .6)
  const x = xCenter(index) - barWidth / 2
  const y0 = scale.value.y(0)
  const y1 = scale.value.y(value)
  const h = Math.abs(y0 - y1)
  if (h < .5) return ''
  const r = Math.min(4, h, barWidth / 2)
  if (value >= 0) {
    return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + barWidth - r}Q${x + barWidth},${y1} ${x + barWidth},${y1 + r}V${y0}Z`
  }
  return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + barWidth - r}Q${x + barWidth},${y1} ${x + barWidth},${y1 - r}V${y0}Z`
}

const labelEvery = computed(() => band.value < 44 ? 2 : 1)

function onPointer(event: PointerEvent) {
  const svg = event.currentTarget as SVGSVGElement
  const x = event.clientX - svg.getBoundingClientRect().left
  const index = Math.floor((x - pad.left) / band.value)
  active.value = index >= 0 && index < props.values.length ? index : null
}

function onKey(event: KeyboardEvent) {
  if (!props.values.length) return
  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
    event.preventDefault()
    const step = event.key === 'ArrowRight' ? 1 : -1
    active.value = Math.min(props.values.length - 1, Math.max(0, (active.value ?? (step > 0 ? -1 : props.values.length)) + step))
  } else if (event.key === 'Escape') active.value = null
}

const tooltipStyle = computed(() => {
  if (active.value === null) return {}
  const x = xCenter(active.value)
  const flip = x > width.value * .65
  return { left: `${x}px`, top: `${Math.max(pad.top, scale.value.y(props.values[active.value]) - 12)}px`, transform: flip ? 'translate(calc(-100% - 12px), -100%)' : 'translate(12px, -100%)' }
})
</script>

<template>
  <div ref="container" class="an-chart">
    <svg
      :width="width"
      :height="height"
      role="img"
      tabindex="0"
      :aria-label="`${seriesName} by month. Use left and right arrow keys to read values.`"
      @pointermove="onPointer"
      @pointerleave="active = null"
      @keydown="onKey"
      @blur="active = null"
    >
      <g class="an-chart__grid">
        <template v-for="tick in scale.ticks" :key="tick">
          <line :x1="pad.left" :x2="width - pad.right" :y1="scale.y(tick)" :y2="scale.y(tick)" :class="{ 'an-chart__baseline': tick === 0 }" />
          <text :x="pad.left - 10" :y="scale.y(tick)" dy="0.32em" text-anchor="end">{{ compactMoney(tick) }}</text>
        </template>
      </g>
      <g class="an-chart__x">
        <template v-for="(label, index) in labels" :key="index">
          <text v-if="index % labelEvery === (labels.length - 1) % labelEvery" :x="xCenter(index)" :y="height - 8" text-anchor="middle">{{ label }}</text>
        </template>
      </g>
      <template v-if="kind === 'line'">
        <path class="an-chart__area" :d="areaPath" />
        <line v-if="active !== null" class="an-chart__crosshair" :x1="xCenter(active)" :x2="xCenter(active)" :y1="pad.top" :y2="height - pad.bottom" />
        <path class="an-chart__line" :d="linePath" />
        <circle v-if="values.length" class="an-chart__dot" :cx="xCenter(values.length - 1)" :cy="scale.y(values[values.length - 1])" r="4" />
        <circle v-if="active !== null" class="an-chart__dot" :cx="xCenter(active)" :cy="scale.y(values[active])" r="5" />
      </template>
      <template v-else>
        <rect v-if="active !== null" class="an-chart__hover-band" :x="pad.left + band * active" :y="pad.top" :width="band" :height="height - pad.top - pad.bottom" />
        <path v-for="(_, index) in values" :key="index" class="an-chart__column" :d="columnPath(index)" />
      </template>
    </svg>
    <div v-if="active !== null" class="an-chart__tooltip" :style="tooltipStyle" role="status">
      <span>{{ labels[active] }}</span><strong>{{ money(values[active]) }}</strong>
    </div>
  </div>
</template>
