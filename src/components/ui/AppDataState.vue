<script setup lang="ts">
import { AlertCircle, RefreshCw } from '@lucide/vue'
import AppSkeleton from './AppSkeleton.vue'
import AppEmptyState from './AppEmptyState.vue'
withDefaults(defineProps<{ loading: boolean; error?: string; empty?: boolean; label?: string; variant?: 'table' | 'report' | 'dashboard' | 'form'; emptyTitle?: string; emptyMessage?: string; actionLabel?: string }>(), { error: '', empty: false, label: 'records', variant: 'table', emptyTitle: 'No records yet', emptyMessage: 'Your saved records will appear here.' })
const emit = defineEmits<{ retry: []; action: [] }>()
</script>

<template>
  <AppSkeleton v-if="loading" :variant="variant" :label="label" />
  <div v-else-if="error" class="app-data-error" role="alert"><AlertCircle :size="24" aria-hidden="true" /><strong>{{ label }} unavailable</strong><p>{{ error }}</p><button type="button" @click="emit('retry')"><RefreshCw :size="15" aria-hidden="true" />Try again</button></div>
  <div v-else-if="empty" class="app-data-empty"><AppEmptyState :title="emptyTitle" :message="emptyMessage" :action-label="actionLabel" @action="emit('action')" /></div>
  <slot v-else />
</template>

<style scoped>
.app-data-empty, .app-data-error { width: 100%; min-width: 0; flex: 0 0 auto; border: 1px solid var(--border, #e2e6ed); border-radius: 8px; background: #fff; }
.app-data-error { min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; padding: 28px 20px; text-align: center; color: #843741; }
.app-data-error strong { font-size: 14px; text-transform: capitalize; }
.app-data-error p { max-width: 55ch; margin: 0; color: #667680; font-size: 12px; line-height: 1.6; }
.app-data-error button { min-height: 38px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border: 1px solid #cfd8df; border-radius: 6px; background: #fff; color: #34424a; font: inherit; font-size: 12px; cursor: pointer; }
.app-data-error button:focus-visible { outline: 3px solid #9bbacd; outline-offset: 3px; }
</style>
