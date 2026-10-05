<script setup lang="ts">
import { AlertCircle, RefreshCw } from '@lucide/vue'

/** Loading and failure states for a list or panel. Renders nothing once the data is ready. */
defineProps<{ status: 'loading' | 'ready' | 'error' | 'idle'; error?: string; label?: string; compact?: boolean }>()
const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <div v-if="status === 'loading' || status === 'idle'" class="app-load-state" :class="{ 'app-load-state--compact': compact }" role="status">
    <span class="app-load-state__spinner" aria-hidden="true" />Loading {{ label ?? 'records' }}…
  </div>
  <div v-else-if="status === 'error'" class="app-load-state app-load-state--error" :class="{ 'app-load-state--compact': compact }" role="alert">
    <AlertCircle :size="18" aria-hidden="true" />
    <span>{{ error || `The ${label ?? 'records'} could not be loaded.` }}</span>
    <button type="button" @click="emit('retry')"><RefreshCw :size="14" aria-hidden="true" /> Try again</button>
  </div>
</template>

<style scoped>
.app-load-state { min-height: 160px; display: flex; flex: 1; align-items: center; justify-content: center; gap: 10px; padding: 24px; color: #5f6b73; font-size: 12px; text-align: center; }
.app-load-state--compact { min-height: 0; flex: 0 0 auto; justify-content: flex-start; padding: 10px 14px; }
.app-load-state--error { flex-wrap: wrap; color: #8f2630; }
.app-load-state button { min-height: 32px; display: inline-flex; align-items: center; gap: 6px; padding: 0 12px; border: 1px solid #d9dfe3; border-radius: 6px; background: #fff; color: #34424a; font: inherit; font-weight: 600; cursor: pointer; }
.app-load-state button:hover { background: #f5f7f8; }
.app-load-state__spinner { width: 16px; height: 16px; border: 2px solid #d8dee2; border-top-color: #3a4a55; border-radius: 50%; animation: app-load-spin .8s linear infinite; }
@keyframes app-load-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .app-load-state__spinner { animation-duration: 2.4s; } }
</style>
