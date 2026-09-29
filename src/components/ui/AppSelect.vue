<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId } from 'vue'
import { ChevronDown } from '@lucide/vue'
import './controls.css'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  modelValue: string
  options: SelectOption[]
  id?: string
  label?: string
  ariaLabel?: string
  placeholder?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  compact?: boolean
}>(), { placeholder: 'Select an option' })
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const uid = props.id ?? useId()
const listId = `${uid}-options`
const labelId = `${uid}-label`
const valueId = `${uid}-value`
const root = ref<HTMLElement | null>(null)
const isOpen = ref(false)
const activeIndex = ref(0)
const selectedIndex = computed(() => props.options.findIndex((option) => option.value === props.modelValue))
const selectedOption = computed(() => props.options[selectedIndex.value])

function nextEnabled(start: number, step: number) {
  if (!props.options.length) return -1
  for (let offset = 0; offset < props.options.length; offset += 1) {
    const index = (start + step * offset + props.options.length * 2) % props.options.length
    if (!props.options[index]?.disabled) return index
  }
  return -1
}

function setActive(index: number) {
  if (index < 0) return
  activeIndex.value = index
  nextTick(() => document.getElementById(`${listId}-${index}`)?.scrollIntoView({ block: 'nearest' }))
}

function open() {
  if (props.disabled || !props.options.length) return
  isOpen.value = true
  setActive(nextEnabled(selectedIndex.value >= 0 ? selectedIndex.value : 0, 1))
}

function choose(index: number) {
  const option = props.options[index]
  if (!option || option.disabled) return
  emit('update:modelValue', option.value)
  isOpen.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (props.disabled) return
  if (event.key === 'Escape' && isOpen.value) {
    event.preventDefault()
    event.stopPropagation()
    isOpen.value = false
    return
  }
  if (event.key === 'Tab') { isOpen.value = false; return }
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (!isOpen.value) { open(); return }
    setActive(nextEnabled(activeIndex.value + (event.key === 'ArrowDown' ? 1 : -1), event.key === 'ArrowDown' ? 1 : -1))
  } else if (event.key === 'Home' || event.key === 'End') {
    event.preventDefault()
    if (!isOpen.value) open()
    setActive(nextEnabled(event.key === 'Home' ? 0 : props.options.length - 1, event.key === 'Home' ? 1 : -1))
  } else if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    if (isOpen.value) choose(activeIndex.value)
    else open()
  } else if (event.key.length === 1 && /\S/.test(event.key)) {
    const index = props.options.findIndex((option) => !option.disabled && option.label.toLowerCase().startsWith(event.key.toLowerCase()))
    if (index >= 0) { event.preventDefault(); open(); setActive(index) }
  }
}

function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) isOpen.value = false
}

onMounted(() => document.addEventListener('pointerdown', onPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onPointerDown))
</script>

<template>
  <div ref="root" class="ui-select" :class="{ 'ui-select--compact': compact, 'ui-select--open': isOpen }">
    <span :id="labelId" class="ui-control-label" :class="{ 'ui-visually-hidden': !label }">
      {{ label || ariaLabel || 'Select option' }}<span v-if="required && label" aria-hidden="true"> *</span>
    </span>
    <button
      :id="uid" type="button" class="ui-control-trigger ui-select__trigger"
      role="combobox" aria-haspopup="listbox" :aria-expanded="isOpen" :aria-controls="listId"
      :aria-labelledby="`${labelId} ${valueId}`" :aria-activedescendant="isOpen ? `${listId}-${activeIndex}` : undefined"
      :aria-required="required || undefined" :aria-invalid="invalid || undefined" :disabled="disabled"
      @click="isOpen ? isOpen = false : open()" @keydown="onKeydown"
    >
      <span :id="valueId" :class="{ 'ui-select__placeholder': !selectedOption }">{{ selectedOption?.label || placeholder }}</span>
      <ChevronDown :size="16" aria-hidden="true" />
    </button>
    <ul v-if="isOpen" :id="listId" class="ui-select__list" role="listbox" :aria-labelledby="labelId">
      <li v-for="(option, index) in options" :id="`${listId}-${index}`" :key="option.value"
        role="option" :aria-selected="modelValue === option.value" :aria-disabled="option.disabled || undefined"
        class="ui-select__option" :class="{ 'ui-select__option--active': activeIndex === index }"
        @mouseenter="!option.disabled && (activeIndex = index)" @mousedown.prevent @click="choose(index)"
      >{{ option.label }}</li>
    </ul>
  </div>
</template>
