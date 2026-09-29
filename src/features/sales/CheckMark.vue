<script setup lang="ts">
import { Check } from '@lucide/vue'

/** Read-only yes/no shown as a checkbox, like the legacy tables. */
defineProps<{ value: boolean; label: string }>()
</script>

<template>
  <span class="sales-check" :class="{ 'sales-check--on': value }" role="img" :aria-label="`${label}: ${value ? 'Yes' : 'No'}`">
    <Check v-if="value" :size="13" :stroke-width="3" aria-hidden="true" />
  </span>
</template>
