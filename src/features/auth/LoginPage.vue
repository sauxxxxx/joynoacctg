<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, UserRound } from '@lucide/vue'
import BrandLogo from '../../components/BrandLogo.vue'
import type { AuthCredentials } from './authTypes'
import { previewCredentials } from './mockAuthService'
import { isPreviewMode } from '../../services/api/config'
import './auth.css'

const props = defineProps<{ loading: boolean; error: string }>()
const emit = defineEmits<{
  signIn: [credentials: AuthCredentials]
  clearError: []
}>()

const REMEMBERED_USERNAME_KEY = 'joyno.remembered-username'

function restoreRememberedUsername() {
  try {
    return window.localStorage.getItem(REMEMBERED_USERNAME_KEY) ?? ''
  } catch {
    return ''
  }
}

const rememberedUsername = restoreRememberedUsername()
const username = ref(rememberedUsername)
const password = ref('')
const rememberUsername = ref(Boolean(rememberedUsername))
const passwordVisible = ref(false)
const capsLockOn = ref(false)
const localError = ref('')
const recoveryNotice = ref(false)
const passwordInput = ref<HTMLInputElement | null>(null)
const usernameInput = ref<HTMLInputElement | null>(null)
const visibleError = computed(() => localError.value || props.error)

function clearMessages() {
  localError.value = ''
  recoveryNotice.value = false
  emit('clearError')
}

function updateCapsLock(event: KeyboardEvent) {
  capsLockOn.value = event.getModifierState('CapsLock')
}

function fillPreviewAccount() {
  username.value = previewCredentials.username
  password.value = previewCredentials.password
  clearMessages()
  nextTick(() => passwordInput.value?.focus())
}

async function submit() {
  clearMessages()
  const { authCredentialsSchema } = await import('../../validation/schemas')
  const result = authCredentialsSchema.safeParse({ username: username.value, password: password.value })
  if (!result.success) {
    localError.value = result.error.issues[0]?.message ?? 'Check your sign-in details.'
    await nextTick()
    if (!username.value.trim()) usernameInput.value?.focus()
    else passwordInput.value?.focus()
    return
  }
  try {
    if (rememberUsername.value) window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username.value.trim())
    else window.localStorage.removeItem(REMEMBERED_USERNAME_KEY)
  } catch {
    // Remembering the username is optional; authentication can continue without browser storage.
  }
  emit('signIn', result.data)
}
</script>

<template>
  <main class="login-page">
    <div class="login-shell">
      <section class="login-visual" aria-labelledby="login-context-title">
        <BrandLogo class="login-visual__brand" />
        <div class="login-visual__art" aria-hidden="true">
          <img src="/login-illustration.webp" alt="" width="1536" height="1024" decoding="async" fetchpriority="low" />
        </div>
        <div class="login-visual__copy">
          <h2 id="login-context-title">Accounting without the clutter.</h2>
          <p>Keep records, tax work, banking, and company operations together.</p>
        </div>
        <span class="login-visual__orb login-visual__orb--top" aria-hidden="true" />
        <span class="login-visual__orb login-visual__orb--bottom" aria-hidden="true" />
      </section>

      <section class="login-access" aria-labelledby="login-title">
        <div class="login-access__inner">
          <BrandLogo class="login-mobile-brand" />
          <BrandLogo class="login-access__mark" :show-wordmark="false" />
          <h1 id="login-title">Log in to your account</h1>
          <p class="login-access__intro">Welcome back. Enter your assigned account details to continue.</p>

          <form class="login-form" novalidate @submit.prevent="submit">
            <label class="login-field">
              <span>Username or email</span>
              <span class="login-input">
                <UserRound :size="17" aria-hidden="true" />
                <input ref="usernameInput" v-model="username" name="username" autocomplete="username" placeholder="Enter your username" :aria-invalid="Boolean(visibleError)" :aria-describedby="visibleError ? 'login-error' : undefined" @input="clearMessages" />
              </span>
            </label>

            <label class="login-field">
              <span>Password</span>
              <span class="login-input login-password">
                <LockKeyhole :size="17" aria-hidden="true" />
                <input ref="passwordInput" v-model="password" name="password" :type="passwordVisible ? 'text' : 'password'" autocomplete="current-password" placeholder="Enter your password" :aria-invalid="Boolean(visibleError)" :aria-describedby="visibleError ? 'login-error' : undefined" @input="clearMessages" @keydown="updateCapsLock" @keyup="updateCapsLock" @blur="capsLockOn = false" />
                <button type="button" :aria-label="passwordVisible ? 'Hide password' : 'Show password'" @click="passwordVisible = !passwordVisible">
                  <EyeOff v-if="passwordVisible" :size="17" aria-hidden="true" />
                  <Eye v-else :size="17" aria-hidden="true" />
                </button>
              </span>
            </label>

            <div class="login-form__support">
              <label class="login-remember"><input v-model="rememberUsername" type="checkbox" /><span>Remember username</span></label>
              <button type="button" @click="recoveryNotice = true">Forgot password?</button>
            </div>

            <p v-if="capsLockOn" class="login-caps" role="status">Caps Lock is on</p>
            <p v-if="visibleError" id="login-error" class="login-message login-message--error" role="alert">{{ visibleError }}</p>
            <p v-else-if="recoveryNotice" class="login-message" role="status">Contact your system administrator to reset your password.</p>

            <button class="login-submit" type="submit" :disabled="loading">
              <LoaderCircle v-if="loading" class="login-submit__spinner" :size="17" aria-hidden="true" />
              <span>{{ loading ? 'Signing in...' : 'Log in' }}</span>
              <ArrowRight v-if="!loading" :size="17" aria-hidden="true" />
            </button>
          </form>

          <div v-if="isPreviewMode" class="login-preview-account">
            <span>Preview access</span>
            <p><strong>{{ previewCredentials.username }}</strong> / {{ previewCredentials.password }}</p>
            <button type="button" @click="fillPreviewAccount">Use preview account</button>
          </div>

          <p class="login-access__legal">JOYNO INC / Authorized personnel only</p>
        </div>
      </section>
    </div>
  </main>
</template>
