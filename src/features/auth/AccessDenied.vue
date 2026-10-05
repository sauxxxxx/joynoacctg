<script setup lang="ts">
import { ArrowLeft, ShieldX } from '@lucide/vue'

defineProps<{ pageName: string }>()
const emit = defineEmits<{ return: [] }>()
</script>

<template>
  <section class="access-denied" role="alert">
    <span class="access-denied__icon"><ShieldX :size="25" aria-hidden="true" /></span>
    <h2>Access denied</h2>
    <p>Your assigned role cannot view {{ pageName }}. Ask an administrator if you need access.</p>
    <button class="ws-button" type="button" @click="emit('return')"><ArrowLeft :size="15" aria-hidden="true" /> Return to dashboard</button>
  </section>
</template>

<style scoped>
.access-denied { min-height: 440px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 9px; text-align: center; }
.access-denied__icon { width: 50px; height: 50px; display: grid; place-items: center; margin-bottom: 5px; border-radius: 13px; background: #f5eded; color: #963b43; }
.access-denied h2 { margin: 0; color: #293239; font-size: 18px; }
.access-denied p { max-width: 440px; margin: 0 0 10px; color: #727d85; font-size: 13px; line-height: 1.55; }
</style>
