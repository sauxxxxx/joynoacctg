<script setup lang="ts">
import type { SettingsConfig } from './companySettings'
import RecordField from './RecordField.vue'
import SaveBar from './SaveBar.vue'
import { useSettingsDraft } from './useSettingsDraft'
import '../workspace/workspace.css'
import './company.css'

const props = defineProps<{ config: SettingsConfig }>()
const { draft, error, notice, dirty, save, discard } = useSettingsDraft(props.config.store, props.config.subject, props.config.validate)
</script>

<template>
  <section class="ws-page co-page" :aria-label="config.subject">
    <div class="ws-stack">
      <p v-if="notice && !dirty" class="ws-notice" role="status">{{ notice }}</p>
      <slot name="before" :draft="draft" />
      <div v-for="(section, index) in config.sections" :key="section.title ?? index" class="ws-panel co-card">
        <h2 v-if="section.title" class="co-card__title">{{ section.title }}</h2>
        <div class="ws-form" :class="{ 'co-form--three': section.columns === 3 }">
          <RecordField v-for="field in section.fields" :id="`settings-${field.key}`" :key="field.key" v-model="draft[field.key]" :field="field" />
        </div>
      </div>
      <SaveBar :dirty="dirty" :error="error" @save="save" @discard="discard" />
    </div>
  </section>
</template>
