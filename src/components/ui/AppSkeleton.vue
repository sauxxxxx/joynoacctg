<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'table' | 'report' | 'dashboard' | 'form'; label?: string }>(), { variant: 'table', label: 'records' })
</script>

<template>
  <div class="app-skeleton" :class="`app-skeleton--${variant}`" role="status" aria-live="polite" aria-busy="true">
    <span class="app-skeleton__label">Loading {{ label }}…</span>
    <div class="app-skeleton__layout" aria-hidden="true">
      <section v-for="panel in (variant === 'dashboard' ? 5 : 1)" :key="panel" class="app-skeleton__panel">
        <div class="app-skeleton__heading"><i class="app-skeleton__block" /><i class="app-skeleton__block" /></div>
        <div v-if="variant === 'dashboard' || variant === 'report'" class="app-skeleton__metrics"><i v-for="metric in 3" :key="metric" class="app-skeleton__block" /></div>
        <div v-if="variant === 'dashboard' && panel === 1" class="app-skeleton__chart app-skeleton__block" />
        <div v-else class="app-skeleton__rows">
          <div v-for="row in (variant === 'form' ? 4 : 5)" :key="row" class="app-skeleton__row"><i v-for="column in (variant === 'form' ? 2 : 3)" :key="column" class="app-skeleton__block" /></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.app-skeleton { width: 100%; min-width: 0; padding: 2px 0; }
.app-skeleton__label { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.app-skeleton__layout { display: grid; gap: 16px; }
.app-skeleton__panel { min-width: 0; overflow: hidden; border: 1px solid var(--border, #e2e6ed); border-radius: 10px; background: #fff; }
.app-skeleton__block { display: block; border-radius: 5px; background: #eaf0f3; animation: skeleton-pulse 1.6s ease-in-out infinite; }
.app-skeleton__heading { display: grid; gap: 10px; padding: 20px; border-bottom: 1px solid var(--border, #e2e6ed); }
.app-skeleton__heading i { width: min(180px, 55%); height: 14px; }
.app-skeleton__heading i + i { width: min(280px, 75%); height: 9px; }
.app-skeleton__row { display: grid; grid-template-columns: 1.2fr 1.6fr .8fr; gap: 24px; padding: 18px 20px; border-bottom: 1px solid #f1f4f6; }
.app-skeleton__row:last-child { border-bottom: 0; }
.app-skeleton__row i { height: 12px; }
.app-skeleton__row:nth-child(even) i { width: 75%; }
.app-skeleton__metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; padding: 24px 20px; }
.app-skeleton__metrics i { height: 34px; }
.app-skeleton__chart { height: 180px; margin: 0 20px 20px; }
.app-skeleton--dashboard .app-skeleton__layout { grid-template-columns: repeat(6, minmax(0, 1fr)); }
.app-skeleton--dashboard .app-skeleton__panel { grid-column: span 2; }
.app-skeleton--dashboard .app-skeleton__panel:first-child { grid-column: span 4; }
.app-skeleton--dashboard .app-skeleton__panel:nth-child(2) .app-skeleton__metrics { display: none; }
.app-skeleton--form .app-skeleton__row { grid-template-columns: 1fr 1fr; padding-block: 22px; }
.app-skeleton--form .app-skeleton__row i { height: 36px; }
@keyframes skeleton-pulse { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .app-skeleton__block { animation: none; } }
@media (max-width: 900px) { .app-skeleton--dashboard .app-skeleton__layout { grid-template-columns: 1fr; } .app-skeleton--dashboard .app-skeleton__panel, .app-skeleton--dashboard .app-skeleton__panel:first-child { grid-column: auto; } .app-skeleton__row { gap: 16px; } }
</style>
