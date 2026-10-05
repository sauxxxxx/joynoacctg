<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{ page: number; pageSize?: number; total: number; label?: string }>(), { pageSize: 25, label: 'records' })
const emit = defineEmits<{ 'update:page': [page: number] }>()
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)))
const from = computed(() => props.total ? (props.page - 1) * props.pageSize + 1 : 0)
const to = computed(() => Math.min(props.page * props.pageSize, props.total))
</script>

<template>
  <nav class="app-pagination" :aria-label="`${label} pagination`">
    <span>{{ from }}–{{ to }} of {{ total }} {{ label }}</span>
    <div>
      <button type="button" :disabled="page <= 1" @click="emit('update:page', page - 1)">Previous</button>
      <span>Page {{ page }} of {{ pages }}</span>
      <button type="button" :disabled="page >= pages" @click="emit('update:page', page + 1)">Next</button>
    </div>
  </nav>
</template>

<style scoped>
.app-pagination { min-height: 48px; display: flex; align-items: center; justify-content: space-between; gap: 20px; padding: 8px 14px; border-top: 1px solid #e2e6ed; color: #667085; font-size: 12px; }
.app-pagination div { display: flex; align-items: center; gap: 12px; }
.app-pagination button { min-height: 32px; padding: 0 12px; border: 1px solid #cfd6e2; border-radius: 6px; background: #fff; color: #263044; font: inherit; cursor: pointer; }
.app-pagination button:disabled { opacity: .45; cursor: not-allowed; }
.app-pagination button:focus-visible { outline: 3px solid rgb(49 87 183 / 22%); outline-offset: 2px; }
</style>
