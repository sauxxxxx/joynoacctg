<script setup lang="ts">
import { computed, ref } from 'vue'
import { Info } from '@lucide/vue'
import { recordAudit } from './companyStore'
import type { SettingsConfig } from './companySettings'
import RecordField from './RecordField.vue'
import '../workspace/workspace.css'
import './company.css'

const props = defineProps<{ config: SettingsConfig }>()
const clone = (value: unknown) => JSON.parse(JSON.stringify(value)) as Record<string, unknown>
const draft = ref(clone(props.config.store.value))
const error = ref('')
const notice = ref('')
const dirty = computed(() => JSON.stringify(normalized(draft.value)) !== JSON.stringify(props.config.store.value))

function normalized(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, typeof item === 'string' ? item.trim() : item]))
}

function save() {
  const candidate = normalized(draft.value)
  const parsed = props.config.schema.safeParse(candidate)
  if (!parsed.success) {
    error.value = parsed.error.issues[0]?.message ?? 'Check the highlighted fields.'
    return
  }
  const changed = props.config.fields
    .filter((field) => JSON.stringify(candidate[field.key]) !== JSON.stringify(props.config.store.value[field.key]))
    .map((field) => field.label)
  props.config.store.value = { ...props.config.store.value, ...candidate }
  draft.value = clone(props.config.store.value)
  error.value = ''
  notice.value = `${props.config.subject} saved.`
  recordAudit('Company', 'Updated', props.config.subject, changed.length ? `Changed: ${changed.join(', ')}` : '')
}

function discard() {
  draft.value = clone(props.config.store.value)
  error.value = ''
}
</script>

<template>
  <section class="ws-page co-page" :aria-label="config.subject">
    <div class="ws-stack">
      <p class="co-intro">{{ config.description }}</p>
      <p v-if="config.note" class="ws-note"><Info :size="14" aria-hidden="true" />{{ config.note }}</p>
      <p v-if="notice && !dirty" class="ws-notice" role="status">{{ notice }}</p>
      <form class="ws-panel co-settings" novalidate @submit.prevent="save">
        <div class="ws-panel__body">
          <div class="ws-form">
            <template v-for="field in config.fields" :key="field.key">
              <h2 v-if="field.section" class="ws-form__section">{{ field.section }}</h2>
              <RecordField :id="`settings-${field.key}`" v-model="draft[field.key]" :field="field" />
            </template>
          </div>
          <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        </div>
        <div class="co-settings__footer">
          <span>{{ dirty ? 'You have unsaved changes.' : 'All changes saved.' }}</span>
          <button class="ws-button" type="button" :disabled="!dirty" @click="discard">Discard</button>
          <button class="ws-button ws-button--primary" type="submit" :disabled="!dirty">Save changes</button>
        </div>
      </form>
    </div>
  </section>
</template>
