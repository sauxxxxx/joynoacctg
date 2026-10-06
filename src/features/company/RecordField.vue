<script setup lang="ts">
import { computed } from 'vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import type { FieldDef } from './recordConfig'

const props = defineProps<{ field: FieldDef; modelValue: unknown; id: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: unknown] }>()

const asText = computed({
  get: () => props.modelValue === undefined || props.modelValue === null ? '' : String(props.modelValue),
  set: (value: string) => emit('update:modelValue', value),
})
const isNumeric = computed(() => ['number', 'money', 'percent'].includes(props.field.type))

function onNumber(event: Event) {
  const raw = (event.target as HTMLInputElement).value
  emit('update:modelValue', raw === '' ? '' : Number(raw))
}
</script>

<template>
  <label v-if="field.type === 'checkbox'" class="ws-check ws-form__full">
    <input :id="id" type="checkbox" :checked="Boolean(modelValue)" @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)" /> {{ field.label }}
  </label>
  <div v-else-if="field.type === 'select' || field.type === 'date'" class="ws-field" :class="{ 'ws-form__full': field.full }">
    <AppSelect v-if="field.type === 'select'" :id="id" v-model="asText" :label="field.label" :required="field.required" :options="field.options?.() ?? []" :placeholder="field.placeholder ?? 'Select'" />
    <AppDatePicker v-else :id="id" v-model="asText" :label="field.label" :required="field.required" />
    <small v-if="field.hint">{{ field.hint }}</small>
  </div>
  <label v-else class="ws-field" :class="{ 'ws-form__full': field.full || field.type === 'textarea' }">
    <span>{{ field.label }}<em v-if="field.required"> *</em></span>
    <textarea v-if="field.type === 'textarea'" :id="id" v-model="asText" :maxlength="field.maxlength ?? 2000" :placeholder="field.placeholder" rows="4" />
    <span v-else-if="isNumeric && field.type !== 'number'" class="ws-field__prefix">
      <b aria-hidden="true">{{ field.type === 'money' ? '₱' : '%' }}</b>
      <input :id="id" :value="asText" type="number" :min="field.min ?? 0" :max="field.type === 'percent' ? field.max ?? 100 : field.max" :step="field.step ?? 0.01" :required="field.required" @input="onNumber" />
    </span>
    <input v-else-if="field.type === 'number'" :id="id" :value="asText" type="number" :min="field.min" :max="field.max" :step="field.step ?? 1" :required="field.required" @input="onNumber" />
    <input v-else :id="id" v-model="asText" :type="field.type === 'password' ? 'password' : field.type === 'email' ? 'email' : 'text'" :autocomplete="field.type === 'password' ? 'new-password' : undefined" :required="field.required" :maxlength="field.maxlength ?? 160" :placeholder="field.placeholder" />
    <small v-if="field.hint">{{ field.hint }}</small>
  </label>
</template>
