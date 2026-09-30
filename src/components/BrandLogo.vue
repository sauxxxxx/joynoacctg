<script setup lang="ts">
withDefaults(defineProps<{
  showWordmark?: boolean
  compact?: boolean
}>(), {
  showWordmark: true,
  compact: false,
})
</script>

<template>
  <span class="joyno-brand" :class="{ 'joyno-brand--compact': compact }">
    <span class="joyno-brand__mark" aria-hidden="true">
      <svg viewBox="0 0 64 56" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round" focusable="false">
        <path d="M8 54V32c0-8 4-14 11-18L50 1v11c0 7-4 13-10 17L21 40v14" />
        <path d="M26 54V42c0-7 3-12 9-16l22-13v12c0 6-3 11-9 15l-9 5v9" />
        <path d="M44 54v-5c0-5 3-9 7-12l12-7v10c0 5-3 9-7 12l-4 2" />
      </svg>
    </span>
    <span v-if="showWordmark" class="joyno-brand__copy">
      <strong>Joyno</strong>
      <small>Accounting</small>
    </span>
    <span v-else class="sr-only">Joyno Accounting</span>
  </span>
</template>

<style scoped>
.joyno-brand { display: inline-flex; align-items: center; gap: 10px; color: #202428; }
.joyno-brand__mark { width: 28px; height: 25px; display: grid; place-items: center; flex: 0 0 auto; }
.joyno-brand__mark svg { width: 100%; height: 100%; overflow: visible; }
.joyno-brand__copy { display: flex; flex-direction: column; line-height: 1; letter-spacing: -.025em; }
.joyno-brand__copy strong { font-size: 17px; font-weight: 760; }
.joyno-brand__copy small { margin-top: 4px; color: #727b82; font-size: 9px; letter-spacing: .01em; }
.joyno-brand--compact { gap: 7px; }
.joyno-brand--compact .joyno-brand__mark { width: 22px; height: 20px; }
.joyno-brand--compact .joyno-brand__copy strong { font-size: 14px; }
.joyno-brand--compact .joyno-brand__copy small { margin-top: 3px; font-size: 8px; }
</style>
