<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import { http } from '../../services/api/httpClient'
import { errorMessage } from '../../services/api/errors'
import type { EntityResponseDto } from '../../contracts/dto'
import { useAuth } from './authStore'

const props = defineProps<{ mode: 'profile' | 'password' | null }>()
const emit = defineEmits<{ close: [] }>()
type Profile = { id: string; username: string; name: string; email: string; version: number }
const dialog = ref<HTMLDialogElement | null>(null)
const profile = ref<Profile | null>(null)
const currentPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const { signOut } = useAuth()
let generation = 0

async function load() {
  const current = ++generation
  loading.value = true; error.value = ''; profile.value = null
  try {
    const result = await http.get<EntityResponseDto<Profile>>('/auth/me', { tenant: false })
    if (current === generation && props.mode) profile.value = result.data
  } catch (cause) { if (current === generation) error.value = errorMessage(cause, 'Your account could not be loaded.') }
  finally { if (current === generation) loading.value = false }
}

function close() {
  if (busy.value) return
  generation++; dialog.value?.close(); emit('close')
  profile.value = null; currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
}

async function save() {
  if (busy.value || loading.value || !profile.value) return
  error.value = ''
  if (props.mode === 'password' && newPassword.value !== confirmPassword.value) { error.value = 'The new passwords do not match.'; return }
  busy.value = true
  try {
    const shared = { expectedVersion: profile.value.version, currentPassword: currentPassword.value }
    if (props.mode === 'password') await http.post('/auth/change-password', { ...shared, newPassword: newPassword.value }, { tenant: false })
    else await http.patch('/auth/me', { ...shared, name: profile.value.name.trim(), email: profile.value.email.trim() }, { tenant: false })
    busy.value = false; close()
    signOut('Your account was updated. Sign in again to continue.')
  } catch (cause) { error.value = errorMessage(cause, 'Your account could not be updated.') }
  finally { busy.value = false }
}

watch(() => props.mode, async (mode) => {
  if (!mode) return
  currentPassword.value = ''; newPassword.value = ''; confirmPassword.value = ''
  await nextTick(); dialog.value?.showModal(); await load()
})
</script>

<template>
  <dialog ref="dialog" class="ws-dialog ws-dialog--small" :aria-label="mode === 'password' ? 'Change password' : 'My profile'" @cancel.prevent="close" @close="emit('close')">
    <form @submit.prevent="save">
      <div class="ws-dialog__header"><h2>{{ mode === 'password' ? 'Change password' : 'My profile' }}</h2><button class="ws-icon-button" type="button" aria-label="Close" :disabled="busy" @click="close"><X :size="18" /></button></div>
      <div class="ws-dialog__body">
        <p v-if="loading" role="status">Loading your account…</p>
        <fieldset v-if="profile" class="ws-form" :disabled="busy" style="border: 0; padding: 0; margin: 0">
          <p class="ws-form__full">Username: {{ profile.username }}</p>
          <template v-if="mode === 'profile'">
            <label class="ws-field ws-form__full"><span>Name</span><input v-model="profile.name" required maxlength="120" autocomplete="name" /></label>
            <label class="ws-field ws-form__full"><span>Email</span><input v-model="profile.email" type="email" maxlength="254" autocomplete="email" /></label>
          </template>
          <label class="ws-field ws-form__full"><span>Current password</span><input v-model="currentPassword" type="password" required maxlength="256" autocomplete="current-password" /></label>
          <template v-if="mode === 'password'">
            <label class="ws-field ws-form__full"><span>New password</span><input v-model="newPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" /></label>
            <label class="ws-field ws-form__full"><span>Confirm new password</span><input v-model="confirmPassword" type="password" required minlength="12" maxlength="128" autocomplete="new-password" /></label>
          </template>
          <p class="ws-form__full">Saving signs you out on all devices. Use 12–128 characters for a new password.</p>
        </fieldset>
        <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        <button v-if="!profile && !loading" class="ws-button" type="button" @click="load">Retry</button>
      </div>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" :disabled="busy" @click="close">Cancel</button><button class="ws-button ws-button--primary" type="submit" :disabled="busy || loading || !profile">{{ busy ? 'Saving…' : 'Save and sign out' }}</button></div>
    </form>
  </dialog>
</template>
