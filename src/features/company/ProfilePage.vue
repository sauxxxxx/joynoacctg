<script setup lang="ts">
import { ref } from 'vue'
import { ImagePlus, Store, Trash2 } from '@lucide/vue'
import { settingsPages } from './companySettings'
import SettingsPage from './SettingsPage.vue'

const config = settingsPages['company-profile']
const logoError = ref('')
const maxBytes = 500 * 1024

// The logo is kept as a data URL in the profile so reports can print it.
function chooseLogo(event: Event, draft: Record<string, unknown>) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) { logoError.value = 'Choose a PNG, JPG, or WebP image.'; return }
  if (file.size > maxBytes) { logoError.value = 'The logo can be up to 500 KB.'; return }
  logoError.value = ''
  const reader = new FileReader()
  reader.onload = () => { draft.logo = String(reader.result) }
  reader.readAsDataURL(file)
}
</script>

<template>
  <SettingsPage :config="config">
    <template #before="{ draft }">
      <div class="co-logo">
        <div class="co-logo__frame">
          <img v-if="draft.logo" :src="String(draft.logo)" alt="Company logo" />
          <Store v-else :size="56" aria-hidden="true" />
        </div>
        <div class="co-logo__actions">
          <label class="ws-button ws-button--small co-logo__upload">
            <ImagePlus :size="15" aria-hidden="true" /> {{ draft.logo ? 'Change logo' : 'Upload logo' }}
            <input type="file" accept="image/*" @change="chooseLogo($event, draft)" />
          </label>
          <button v-if="draft.logo" class="ws-button ws-button--small" type="button" @click="draft.logo = ''"><Trash2 :size="15" aria-hidden="true" /> Remove</button>
        </div>
        <label class="ws-check"><input v-model="draft.logoContainsName" type="checkbox" /> Logo contains Company Name</label>
        <p v-if="logoError" class="ws-form-error" role="alert">{{ logoError }}</p>
      </div>
    </template>
  </SettingsPage>
</template>
