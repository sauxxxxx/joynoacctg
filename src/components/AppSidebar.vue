<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Search, X } from '@lucide/vue'
import NavNode from './NavNode.vue'
import BrandLogo from './BrandLogo.vue'
import { findAncestorIds, navigation, type NavigationItem } from '../navigation'

const props = defineProps<{
  activeId: string
  collapsed: boolean
  mobileOpen: boolean
  isMobile: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
  expand: []
}>()

const query = ref('')
const expandedIds = ref<string[]>(findAncestorIds(props.activeId))
const activeAncestorIds = computed(() => findAncestorIds(props.activeId))
const closeButton = ref<HTMLButtonElement | null>(null)

watch(() => props.mobileOpen, (open) => {
  if (open) nextTick(() => closeButton.value?.focus())
})

watch(() => props.activeId, (id) => {
  expandedIds.value = findAncestorIds(id)
})

function filterItems(items: NavigationItem[], term: string): NavigationItem[] {
  return items.flatMap((item) => {
    const children = item.children && filterItems(item.children, term)
    if (item.label.toLocaleLowerCase().includes(term)) return [item]
    if (children?.length) return [{ ...item, children }]
    return []
  })
}

const visibleItems = computed(() => {
  const term = query.value.trim().toLocaleLowerCase()
  return term ? filterItems(navigation, term) : navigation
})

function toggle(id: string) {
  if (props.collapsed) {
    emit('expand')
    return
  }
  if (navigation.some((item) => item.id === id)) {
    expandedIds.value = expandedIds.value.includes(id) ? [] : [id]
    return
  }
  expandedIds.value = expandedIds.value.includes(id)
    ? expandedIds.value.filter((expandedId) => expandedId !== id)
    : [...expandedIds.value, id]
}

function select(id: string) {
  query.value = ''
  emit('select', id)
  emit('close')
}
</script>

<template>
  <div v-if="mobileOpen" class="sidebar-backdrop" @click="emit('close')" />
  <aside
    class="sidebar"
    :class="{ 'sidebar--collapsed': collapsed, 'sidebar--mobile-open': mobileOpen }"
    :inert="isMobile && !mobileOpen"
    aria-label="Main navigation"
  >
    <div class="sidebar__brand">
      <BrandLogo />
      <button ref="closeButton" class="icon-button sidebar__close" type="button" aria-label="Close navigation" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>

    <div class="sidebar__search">
      <Search :size="15" aria-hidden="true" />
      <input v-model="query" aria-label="Search navigation" type="search" placeholder="Search menu..." />
    </div>

    <nav class="sidebar__nav" aria-label="Sections">
      <ul v-if="visibleItems.length" class="nav-list">
        <NavNode
          v-for="item in visibleItems"
          :key="item.id"
          :item="item"
          :depth="0"
          :active-id="activeId"
          :active-ancestor-ids="activeAncestorIds"
          :expanded-ids="expandedIds"
          :filtered="Boolean(query.trim())"
          @select="select"
          @toggle="toggle"
        />
      </ul>
      <p v-else class="sidebar__no-results">No matching sections</p>
    </nav>

    <div class="sidebar__footer">
      <BrandLogo compact />
    </div>
  </aside>
</template>
