<script setup lang="ts">
import { FileText } from '@lucide/vue'
defineProps<{ title: string; message: string; actionLabel?: string; compact?: boolean }>()
const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="app-empty-state" :class="{ 'app-empty-state--compact': compact }" role="status">
    <span class="app-empty-state__icon" aria-hidden="true"><slot name="icon"><FileText :size="22" /></slot></span>
    <strong>{{ title }}</strong>
    <p>{{ message }}</p>
    <button v-if="actionLabel" type="button" @click="emit('action')">{{ actionLabel }}</button>
  </div>
</template>

<style scoped>
.app-empty-state { min-height: 220px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 28px 20px; text-align: center; color: #34424a; }
.app-empty-state--compact { min-height: 160px; padding: 22px 18px; }
.app-empty-state__icon { display: grid; place-items: center; width: 42px; height: 42px; margin-bottom: 12px; border-radius: 12px; background: #f0f4f6; color: #647480; }
.app-empty-state strong { font-size: 14px; font-weight: 650; }
.app-empty-state p { max-width: 48ch; margin: 8px 0 0; color: #667680; font-size: 12px; line-height: 1.6; }
.app-empty-state button { min-height: 38px; margin-top: 16px; padding: 0 14px; border: 1px solid #cfd8df; border-radius: 6px; background: #fff; color: #2b4658; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.app-empty-state button:hover { background: #f4f7f9; }
.app-empty-state button:focus-visible { outline: 3px solid #9bbacd; outline-offset: 3px; }
</style>
