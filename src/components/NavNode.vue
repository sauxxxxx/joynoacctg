<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import type { NavigationItem } from '../navigation'

defineOptions({ name: 'NavNode' })

const props = defineProps<{
  item: NavigationItem
  depth: number
  activeId: string
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
      :class="{ 'nav-link--active': activeId === item.id, 'nav-link--parent': item.children?.length }"
      :style="{ '--nav-depth': depth }"
      type="button"
      :title="item.label"
      :aria-current="activeId === item.id ? 'page' : undefined"
      :aria-expanded="item.children?.length ? isExpanded() : undefined"
      @click="item.children?.length ? emit('toggle', item.id) : emit('select', item.id)"
    >
      <component :is="item.icon" v-if="item.icon" class="nav-link__icon" :size="17" :stroke-width="1.8" aria-hidden="true" />
      <span class="nav-link__label">{{ item.label }}</span>
      <ChevronDown
        v-if="item.children?.length"
        class="nav-link__chevron"
        :class="{ 'nav-link__chevron--open': isExpanded() }"
        :size="14"
        aria-hidden="true"
      />
    </button>
    <ul v-if="item.children?.length && isExpanded()" class="nav-children">
      <NavNode
        v-for="child in item.children"
        :key="child.id"
        :item="child"
        :depth="depth + 1"
        :active-id="activeId"
        :expanded-ids="expandedIds"
        :filtered="filtered"
        @select="emit('select', $event)"
        @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>
