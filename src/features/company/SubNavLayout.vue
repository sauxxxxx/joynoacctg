<script setup lang="ts" generic="T extends string">
import type { Component } from 'vue'

/** Page with a secondary menu on the left, like the legacy Registration, Recording, and Tax Rules screens. */
defineProps<{ items: { id: T; label: string; icon: Component }[]; label: string }>()
const active = defineModel<T>({ required: true })
</script>

<template>
  <div class="co-subnav-layout">
    <nav class="co-subnav" :aria-label="label">
      <button v-for="item in items" :key="item.id" type="button" class="co-subnav__item" :aria-current="active === item.id ? 'page' : undefined" @click="active = item.id">
        <component :is="item.icon" :size="17" aria-hidden="true" />{{ item.label }}
      </button>
    </nav>
    <div class="co-subnav-layout__content"><slot /></div>
  </div>
</template>
