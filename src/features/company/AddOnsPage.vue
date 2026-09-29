<script setup lang="ts">
import { ref } from 'vue'
import { addOns, recordAudit, type AddOn } from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const notice = ref('')

function toggle(addOn: AddOn, enabled: boolean) {
  addOns.value = addOns.value.map((item) => item.id === addOn.id ? { ...item, enabled } : item)
  recordAudit('Company', enabled ? 'Enabled' : 'Disabled', `Add-on: ${addOn.name}`)
  notice.value = `${addOn.name} ${enabled ? 'turned on' : 'turned off'}.`
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Add-ons">
    <div class="ws-stack">
      <p class="co-intro">Optional features. Turning one off hides it everywhere it appears.</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>
      <div class="co-addons">
        <article v-for="addOn in addOns" :key="addOn.id" class="co-addon">
          <header>
            <h2>{{ addOn.name }}</h2>
            <span v-if="!addOn.available" class="ws-badge">Not available yet</span>
            <span v-else class="ws-badge" :class="addOn.enabled ? 'ws-badge--success' : ''">{{ addOn.enabled ? 'On' : 'Off' }}</span>
          </header>
          <p>{{ addOn.description }}</p>
          <footer>
            <span class="ws-muted">{{ addOn.module }}</span>
            <label class="ws-switch">
              <input type="checkbox" :checked="addOn.enabled" :disabled="!addOn.available" @change="toggle(addOn, ($event.target as HTMLInputElement).checked)" />
              <span class="ws-switch__track" aria-hidden="true" />
              <span class="ws-visually-hidden">{{ addOn.name }}</span>
            </label>
          </footer>
        </article>
      </div>
    </div>
  </section>
</template>
