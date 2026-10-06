<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Building2, ChevronDown, CircleHelp, Info, KeyRound, LogOut, UserRound } from '@lucide/vue'
import AccountDialog from '../features/auth/AccountDialog.vue'
import type { AuthUser } from '../features/auth/authTypes'
import { usePermissions } from '../features/auth/permissions'
import { supportsWorkspacePage } from '../services/api/config'

const props = defineProps<{ user: AuthUser }>()
const emit = defineEmits<{ navigate: [id: string]; logout: [] }>()

const open = ref(false)
const notice = ref('')
const accountDialog = ref<'profile' | 'password' | null>(null)
function openAccount(mode: 'profile' | 'password') { closeMenu(); accountDialog.value = mode }
const container = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const firstItem = ref<HTMLButtonElement | null>(null)
const initials = computed(() => props.user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toLocaleUpperCase())
const { can } = usePermissions(() => props.user)
const canManageCompany = computed(() => can('Company', 'edit') && supportsWorkspacePage('company-profile'))

function toggleMenu() {
  open.value = !open.value
  notice.value = ''
  if (open.value) nextTick(() => firstItem.value?.focus())
}

function closeMenu(restoreFocus = false) {
  open.value = false
  notice.value = ''
  if (restoreFocus) nextTick(() => trigger.value?.focus())
}

function navigate(id: string) {
  emit('navigate', id)
  closeMenu()
}

function logout() {
  closeMenu()
  emit('logout')
}

function showNotice(message: string) {
  notice.value = message
}

function onPointerDown(event: PointerEvent) {
  if (open.value && event.target instanceof Node && !container.value?.contains(event.target)) closeMenu()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) closeMenu(true)
}

function onMenuKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const items = Array.from(container.value?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
  if (!items.length) return
  event.preventDefault()
  const current = items.indexOf(document.activeElement as HTMLButtonElement)
  const next = event.key === 'Home' ? 0
    : event.key === 'End' ? items.length - 1
      : event.key === 'ArrowUp' ? (current <= 0 ? items.length - 1 : current - 1)
        : (current + 1) % items.length
  items[next]?.focus()
}

onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="container" class="account-menu-wrap">
    <button ref="trigger" class="account-chip" type="button" :aria-label="`Open account menu for ${user.name}`" aria-haspopup="menu" aria-controls="account-menu" :aria-expanded="open" @click="toggleMenu">
      <span class="account-chip__avatar" aria-hidden="true">{{ initials }}</span>
      <span class="account-chip__name">{{ user.name }}</span>
      <ChevronDown class="account-chip__chevron" :size="14" aria-hidden="true" />
    </button>

    <div v-if="open" id="account-menu" class="account-menu" role="menu" aria-label="Account menu" @keydown="onMenuKeydown">
      <div class="account-menu__header">
        <span class="account-menu__avatar" aria-hidden="true">{{ initials }}</span>
        <span class="account-menu__identity"><strong>{{ user.name }}</strong><small>{{ user.role }}</small></span>
      </div>

      <div class="account-menu__section">
        <button ref="firstItem" type="button" role="menuitem" @click="openAccount('profile')"><UserRound :size="17" /><span>My Profile</span></button>
        <button type="button" role="menuitem" @click="openAccount('password')"><KeyRound :size="17" /><span>Change Password</span></button>
        <button v-if="canManageCompany" type="button" role="menuitem" @click="navigate('company-profile')"><Building2 :size="17" /><span>Company Settings</span><small>Authorized</small></button>
      </div>

      <div class="account-menu__section">
        <button type="button" role="menuitem" @click="showNotice('Contact your system administrator for help and access requests.')"><CircleHelp :size="17" /><span>Help &amp; Support</span></button>
        <button type="button" role="menuitem" @click="showNotice('Joyno Accounting / Internal system')"><Info :size="17" /><span>System Information</span></button>
      </div>

      <p v-if="notice" class="account-menu__notice" role="status">{{ notice }}</p>

      <div class="account-menu__section account-menu__section--signout">
        <button type="button" role="menuitem" @click="logout"><LogOut :size="17" /><span>Sign Out</span></button>
      </div>
    </div>
  </div>
  <AccountDialog :mode="accountDialog" @close="accountDialog = null" />
</template>
