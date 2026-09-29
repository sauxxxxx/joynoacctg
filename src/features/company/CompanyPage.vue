<script setup lang="ts">
import { computed } from 'vue'
import AddOnsPage from './AddOnsPage.vue'
import AuditTrailPage from './AuditTrailPage.vue'
import { recordPages } from './companyRecords'
import { settingsPages } from './companySettings'
import type { CompanyPageId } from './companyPages'
import DocumentsPage from './DocumentsPage.vue'
import RecordsPage from './RecordsPage.vue'
import RolesPage from './RolesPage.vue'
import SettingsPage from './SettingsPage.vue'

const props = defineProps<{ pageId: CompanyPageId }>()
const recordConfig = computed(() => recordPages[props.pageId])
const settingsConfig = computed(() => settingsPages[props.pageId])
</script>

<template>
  <SettingsPage v-if="settingsConfig" :config="settingsConfig" />
  <RecordsPage v-else-if="recordConfig" :config="recordConfig" />
  <RolesPage v-else-if="pageId === 'roles'" />
  <AuditTrailPage v-else-if="pageId === 'audit-trail'" />
  <AddOnsPage v-else-if="pageId === 'add-ons'" />
  <DocumentsPage v-else-if="pageId === 'documents'" />
</template>
