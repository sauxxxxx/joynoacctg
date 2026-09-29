<script setup lang="ts">
import { computed } from 'vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { fiscalYearStartMonth } from '../../company/companyStore'
import { presetOptions, type PeriodPreset } from './reportPeriods'
import type { PeriodFilter } from './usePeriodFilter'

const props = defineProps<{ filter: PeriodFilter; idPrefix: string }>()
const options = computed(() => presetOptions(fiscalYearStartMonth.value))
const preset = computed({
  get: () => props.filter.preset.value,
  set: (value: string) => { props.filter.preset.value = value as PeriodPreset },
})
const from = computed({ get: () => props.filter.from.value, set: (value: string) => { props.filter.from.value = value } })
const to = computed({ get: () => props.filter.to.value, set: (value: string) => { props.filter.to.value = value } })
</script>

<template>
  <div class="ws-toolbar__field"><AppSelect :id="`${idPrefix}-period`" v-model="preset" label="Period" :options="options" /></div>
  <div class="ws-toolbar__field"><AppDatePicker :id="`${idPrefix}-from`" v-model="from" label="From" required :invalid="Boolean(filter.error.value)" /></div>
  <div class="ws-toolbar__field"><AppDatePicker :id="`${idPrefix}-to`" v-model="to" label="To" required :invalid="Boolean(filter.error.value)" /></div>
</template>
