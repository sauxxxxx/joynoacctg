<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppSidebar from './components/AppSidebar.vue'
import AppTopbar from './components/AppTopbar.vue'
import { findPage } from './navigation'

const activeId = ref('dashboard')
const sidebarCollapsed = ref(false)
const mobileOpen = ref(false)
const isMobile = ref(false)
const activePage = computed(() => findPage(activeId.value) ?? findPage('dashboard')!)

function syncViewport() {
  isMobile.value = window.matchMedia('(max-width: 900px)').matches
  if (!isMobile.value) mobileOpen.value = false
}

function toggleSidebar() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value
  else sidebarCollapsed.value = !sidebarCollapsed.value
}

function closeMobile() {
  if (!mobileOpen.value) return
  mobileOpen.value = false
  nextTick(() => document.querySelector<HTMLButtonElement>('.topbar__sidebar-toggle')?.focus())
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeMobile()
}

function selectPage(id: string) {
  activeId.value = id
}

onMounted(() => {
  syncViewport()
  window.addEventListener('resize', syncViewport)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', syncViewport)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <a class="skip-link" href="#main-content">Skip to content</a>
  <div class="app-shell" :class="{ 'app-shell--collapsed': sidebarCollapsed }">
    <AppSidebar
      :active-id="activeId"
      :collapsed="sidebarCollapsed"
      :mobile-open="mobileOpen"
      :is-mobile="isMobile"
      @select="selectPage"
      @close="closeMobile"
      @expand="sidebarCollapsed = false"
    />
    <div class="app-shell__body" :inert="mobileOpen">
      <AppTopbar :collapsed="sidebarCollapsed" :is-mobile="isMobile" @toggle-sidebar="toggleSidebar" @select="selectPage" />
      <main id="main-content" class="page-content" tabindex="-1">
        <div class="page-content__heading">
          <nav v-if="activePage.path.length > 1" class="breadcrumbs" aria-label="Breadcrumb">
            <template v-for="(part, index) in activePage.path" :key="`${part}-${index}`">
              <span v-if="index > 0" class="breadcrumbs__divider">/</span><span :class="{ 'breadcrumbs__current': index === activePage.path.length - 1 }">{{ part }}</span>
            </template>
          </nav>
          <h1>{{ activePage.label }}</h1>
        </div>
        <div class="page-content__canvas" />
      </main>
    </div>
  </div>
</template>
