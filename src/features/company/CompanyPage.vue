<script setup lang="ts">
import { computed } from 'vue'
import AddOnsPage from './AddOnsPage.vue'
import AuditTrailPage from './AuditTrailPage.vue'
import { recordPages } from './companyRecords'
import { settingsPages } from './companySettings'
import type { CompanyPageId } from './companyPages'
import DocumentsPage from './DocumentsPage.vue'
import ProfilePage from './ProfilePage.vue'
import RecordingPage from './RecordingPage.vue'
import RecordsPage from './RecordsPage.vue'
import RegistrationPage from './RegistrationPage.vue'
import RolesPage from './RolesPage.vue'
import SettingsPage from './SettingsPage.vue'
import TaxRulesPage from './TaxRulesPage.vue'

const props = defineProps<{ pageId: CompanyPageId }>()
const recordConfig = computed(() => recordPages[props.pageId])
</script>

<template>
  <ProfilePage v-if="pageId === 'company-profile'" />
  <RegistrationPage v-else-if="pageId === 'company-registration'" />
  <RecordingPage v-else-if="pageId === 'company-recording'" />
  <SettingsPage v-else-if="pageId === 'company-reporting'" :config="settingsPages['company-reporting']" />
  <TaxRulesPage v-else-if="pageId === 'company-tax-rules'" />
  <RolesPage v-else-if="pageId === 'roles'" />
  <AuditTrailPage v-else-if="pageId === 'audit-trail'" />
  <AddOnsPage v-else-if="pageId === 'add-ons'" />
  <DocumentsPage v-else-if="pageId === 'documents'" />
  <RecordsPage v-else-if="recordConfig" :config="recordConfig" />
</template>
