<script setup lang="ts">
import AppDataState from '../../components/ui/AppDataState.vue'
import { computed, ref } from 'vue'
import { loadCompanyAccess, loadCompanySettings } from './companyPersistence'
import { errorMessage } from '../../services/api/errors'
import { isPreviewMode } from '../../services/api/config'
import { useAuth } from '../auth/authStore'
import { hasPermission } from '../auth/permissions'
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
const loading = ref(!isPreviewMode && props.pageId !== 'documents')
const loadError = ref('')
const { authUser } = useAuth()
const readOnly = computed(() => ['company-profile', 'company-registration', 'company-recording', 'company-reporting', 'company-tax-rules'].includes(props.pageId) && !hasPermission(authUser.value, 'Company', 'edit'))
async function load() {
  loading.value = true
  loadError.value = ''
  try { await Promise.all([loadCompanySettings(), loadCompanyAccess()]) }
  catch (cause) { loadError.value = errorMessage(cause, 'Company information could not be loaded.') }
  finally { loading.value = false }
}
if (!isPreviewMode && props.pageId !== 'documents') void load()
</script>

<template>
  <AppDataState :loading="loading" :error="loadError" label="Company information" :variant="recordConfig || pageId === 'roles' || pageId === 'audit-trail' ? 'table' : 'form'" @retry="load">
  <fieldset class="company-page" :disabled="readOnly">
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
  </fieldset>
  </AppDataState>
</template>

<style scoped>.company-page { margin: 0; padding: 0; border: 0; min-width: 0; }</style>
