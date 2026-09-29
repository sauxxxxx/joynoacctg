<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { NavigationItem } from '../navigation'

defineOptions({ name: 'NavNode' })

const props = defineProps<{
  item: NavigationItem
  depth: number
  activeId: string
  activeAncestorIds: string[]
  expandedIds: string[]
  filtered: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  toggle: [id: string]
}>()

const isExpanded = () => props.filtered || props.expandedIds.includes(props.item.id)
</script>

<template>
  <li class="nav-node">
    <button
      class="nav-link"
      :class="{
        'nav-link--active': activeId === item.id,
        'nav-link--ancestor': activeAncestorIds.includes(item.id),
        'nav-link--expanded': item.children?.length && isExpanded(),
        'nav-link--module': depth === 0,
        'nav-link--group': depth > 0 && item.children?.length,
        'nav-link--deep-page': depth >= 2 && !item.children?.length,
      }"
      :style="{ '--nav-depth': depth }"
      type="button"
      :title="item.label"
      :aria-current="activeId === item.id ? 'page' : undefined"
      :aria-expanded="item.children?.length ? isExpanded() : undefined"
      @click="item.children?.length ? emit('toggle', item.id) : emit('select', item.id)"
    >
      <component :is="item.icon" v-if="item.icon && (depth < 2 || item.children?.length)" class="nav-link__icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
      <span class="nav-link__label">{{ item.label }}</span>
      <ChevronDown
        v-if="item.children?.length"
        class="nav-link__chevron"
        :class="{ 'nav-link__chevron--open': isExpanded() }"
        :size="14"
        aria-hidden="true"
      />
    </button>
    <ul v-if="item.children?.length && isExpanded()" class="nav-children" :style="{ '--nav-depth': depth }">
      <NavNode
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :depth="depth + 1"
        :active-id="activeId"
        :active-ancestor-ids="activeAncestorIds"
        :expanded-ids="expandedIds"
        :filtered="filtered"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>
