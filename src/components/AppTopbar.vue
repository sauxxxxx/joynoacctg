<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Bell, Menu, PanelLeftClose, PanelLeftOpen, Search } from '@lucide/vue'
import { searchPages } from '../navigation'
import type { AuthUser } from '../features/auth/authTypes'
import AccountMenu from './AccountMenu.vue'
import BrandLogo from './BrandLogo.vue'

const props = defineProps<{ collapsed: boolean; isMobile: boolean; user: AuthUser; allowedPageIds: string[] }>()

const emit = defineEmits<{
  toggleSidebar: []
  select: [id: string]
  logout: []
}>()

const query = ref('')
const searchOpen = ref(false)
const notificationsOpen = ref(false)
const searchInput = ref<HTMLInputElement | null>(null)
const searchContainer = ref<HTMLElement | null>(null)
const notificationsContainer = ref<HTMLElement | null>(null)
const results = computed(() => searchPages(query.value).filter((page) => props.allowedPageIds.includes(page.id)).slice(0, 8))
const shortcutLabel = ref('Ctrl K')

function select(id: string) {
  emit('select', id)
  query.value = ''
  searchOpen.value = false
  searchInput.value?.blur()
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    searchOpen.value = true
    nextTick(() => searchInput.value?.focus())
  }
  if (event.key === 'Escape') {
    searchOpen.value = false
    notificationsOpen.value = false
    searchInput.value?.blur()
  }
}

function onPointerDown(event: PointerEvent) {
  const target = event.target as Node
  if (!searchContainer.value?.contains(target)) searchOpen.value = false
  if (!notificationsContainer.value?.contains(target)) notificationsOpen.value = false
}

onMounted(() => {
  shortcutLabel.value = navigator.platform.includes('Mac') ? '⌘ K' : 'Ctrl K'
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('pointerdown', onPointerDown)
})
</script>

<template>
  <header class="topbar">
    <div class="topbar__leading">
      <button class="icon-button topbar__sidebar-toggle" type="button" :aria-label="isMobile ? 'Open navigation' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'" @click="emit('toggleSidebar')">
        <Menu class="topbar__mobile-menu" :size="19" aria-hidden="true" />
        <PanelLeftOpen v-if="collapsed" class="topbar__desktop-menu" :size="19" aria-hidden="true" />
        <PanelLeftClose v-else class="topbar__desktop-menu" :size="19" aria-hidden="true" />
      </button>
      <BrandLogo class="topbar__brand" compact />
    </div>

    <div ref="searchContainer" class="topbar__search-wrap">
      <label class="topbar__search">
        <Search :size="17" aria-hidden="true" />
        <input
          ref="searchInput"
          v-model="query"
          type="search"
          placeholder="Search anything..."
          aria-label="Search pages"
          aria-controls="page-search-results"
          :aria-expanded="searchOpen"
          @focus="searchOpen = true"
          @keydown.enter="results[0] && select(results[0].id)"
        />
        <kbd>{{ shortcutLabel }}</kbd>
      </label>
      <div v-if="searchOpen && query.trim()" id="page-search-results" class="search-results" aria-label="Page results">
        <button v-for="result in results" :key="result.id" class="search-result" type="button" @click="select(result.id)">
          <component :is="result.icon" v-if="result.icon" :size="17" aria-hidden="true" />
          <span><strong>{{ result.label }}</strong><small>{{ result.path.slice(0, -1).join(' / ') }}</small></span>
        </button>
        <p v-if="!results.length" class="search-results__empty">No matching pages</p>
      </div>
    </div>

    <div class="topbar__actions">
      <div ref="notificationsContainer" class="topbar__popover-wrap">
        <button class="icon-button" type="button" aria-label="Notifications" :aria-expanded="notificationsOpen" @click="notificationsOpen = !notificationsOpen">
          <Bell :size="18" aria-hidden="true" />
        </button>
        <div v-if="notificationsOpen" class="notification-popover" role="status">
          <strong>Notifications</strong>
          <p>You're all caught up.</p>
        </div>
      </div>
      <div class="topbar__divider" />
      <AccountMenu :user="user" @navigate="select" @logout="emit('logout')" />
    </div>
  </header>
</template>
