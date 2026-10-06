<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { errorMessage } from '../../services/api/errors'
import { getApiCredentials } from '../../services/api/session'
import { usePermissions } from '../auth/permissions'
import { useAuth } from '../auth/authStore'
import { Check, Info, Plus, Search, Trash2, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { createRefRepository } from '../../services/refRepository'
import { recordAudit } from './companyStore'
import RecordField from './RecordField.vue'
import type { AnyRecord, FieldDef, RecordsConfig } from './recordConfig'
import '../workspace/workspace.css'
import './company.css'

const props = defineProps<{ config: RecordsConfig }>()
const permissions = usePermissions(useAuth().authUser)
const can = (action: 'create' | 'edit' | 'delete') => permissions.can('Company', action) && (props.config.singular !== 'user' || permissions.currentRole.value?.system)

const search = ref('')
const status = ref('all')
const notice = ref('')
const formError = ref('')
const loadError = ref('')
const loading = ref(false)
const busy = ref(false)
const draft = ref<AnyRecord>({ id: '' })
const pendingDelete = ref<AnyRecord | null>(null)
const formDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const formBody = ref<HTMLElement | null>(null)

const title = computed(() => props.config.singular.charAt(0).toLocaleUpperCase() + props.config.singular.slice(1))
const records = computed(() => props.config.store.value)
const repository = computed(() => createRefRepository(`/company/${props.config.singular}`, props.config.store, { searchText: props.config.searchText }))
const hasStatus = computed(() => props.config.fields.some((field) => field.key === 'active'))
const statusOptions = [{ value: 'all', label: 'All statuses' }, { value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]
const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return records.value.filter((record) => {
    if (hasStatus.value && status.value !== 'all' && Boolean(record.active) !== (status.value === 'active')) return false
    return !term || props.config.searchText(record).toLocaleLowerCase().includes(term)
  })
})
const visibleFields = computed(() => props.config.fields.filter((field) => !field.when || field.when(draft.value)))
const preview = computed(() => props.config.preview?.(draft.value) ?? null)
async function load() {
  const token = getApiCredentials()?.accessToken
  loading.value = true
  loadError.value = ''
  try { const items = await repository.value.listAll(); if (token === getApiCredentials()?.accessToken) props.config.store.value = items }
  catch (cause) { loadError.value = errorMessage(cause, 'Records could not be loaded.') }
  finally { loading.value = false }
}
watch(() => props.config, () => { void load() }, { immediate: true })

// Records open by clicking their row, as in the legacy lists; deleting happens from the form.
function openForm(record?: AnyRecord) {
  if (loading.value || busy.value || (!record && !can('create'))) return
  // Records are plain JSON data; this also unwraps Vue's reactive proxies.
  const stored = JSON.parse(JSON.stringify(record ?? { id: '', ...props.config.empty() }))
  draft.value = props.config.toDraft?.(stored) ?? stored
  formError.value = ''
  formDialog.value?.showModal()
  nextTick(() => formBody.value?.querySelector<HTMLElement>('input, textarea, button')?.focus())
}

function normalized(record: AnyRecord): AnyRecord {
  const result: AnyRecord = { ...record }
  for (const field of props.config.fields) {
    const value = result[field.key]
    if (typeof value === 'string' && field.type !== 'password') result[field.key] = value.trim()
    if (['number', 'money', 'percent'].includes(field.type) && (value === '' || value === null || value === undefined)) result[field.key] = 0
  }
  return result
}

async function save() {
  if (busy.value || !can(draft.value.id ? 'edit' : 'create')) return
  const candidate = normalized(draft.value)
  const parsed = props.config.schema.safeParse(candidate)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message ?? 'Check the highlighted fields.'
    return
  }
  const others = records.value.filter((record) => record.id !== candidate.id)
  const crossError = props.config.validate?.(candidate, others) ?? ''
  if (crossError) {
    formError.value = crossError
    return
  }
  const isNew = !candidate.id
  const domainRecord = props.config.fromDraft?.(candidate) ?? candidate
  const saved = { ...domainRecord, id: candidate.id || crypto.randomUUID() }
  busy.value = true
  try { await repository.value.save(saved) }
  catch (cause) { formError.value = errorMessage(cause, 'Your changes could not be saved.'); return }
  finally { busy.value = false }
  recordAudit(props.config.auditModule, isNew ? 'Created' : 'Updated', `${title.value}: ${props.config.label(saved)}`)
  notice.value = `${props.config.label(saved)} ${isNew ? 'added' : 'updated'}.`
  formDialog.value?.close()
}

function deleteFromForm() {
  if (busy.value || !can('delete')) return
  const record = records.value.find((item) => item.id === draft.value.id)
  if (!record) return
  const blocker = props.config.deleteBlocker?.(record)
  if (blocker) {
    formError.value = blocker
    return
  }
  formDialog.value?.close()
  pendingDelete.value = record
  deleteDialog.value?.showModal()
}

async function confirmDelete() {
  if (busy.value || !can('delete')) return
  const record = pendingDelete.value
  if (!record) return
  busy.value = true
  try { await repository.value.remove(record.id, record.version) }
  catch (cause) { formError.value = errorMessage(cause, 'This record could not be deleted.'); return }
  finally { busy.value = false }
  recordAudit(props.config.auditModule, 'Deleted', `${title.value}: ${props.config.label(record)}`)
  if (props.config.singular === 'user') await load()
  notice.value = `${props.config.label(record)} ${props.config.singular === 'user' ? 'deactivated' : 'deleted'}.`
  deleteDialog.value?.close()
}

function fieldId(field: FieldDef) {
  return `record-${props.config.singular.replace(/\W+/g, '-')}-${field.key}`
}
</script>

<template>
  <section class="ws-page co-page" :aria-label="`${title} records`">
    <div class="ws-stack">
      <p v-if="config.note" class="ws-note"><Info :size="14" aria-hidden="true" />{{ config.note }}</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>

      <div class="ws-panel ws-panel--clip">
        <div class="ws-panel__header">
          <div><h2>{{ config.heading ?? title }}</h2><p>{{ config.description }}</p></div>
          <div class="ws-panel__actions">
            <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" :aria-label="`Search ${config.plural}`" /></label>
            <div v-if="hasStatus" class="ws-toolbar__field"><AppSelect v-model="status" aria-label="Filter by status" :options="statusOptions" /></div>
            <button v-if="can('create')" class="ws-button ws-button--primary" type="button" :disabled="loading || busy || Boolean(loadError)" @click="openForm()"><Plus :size="16" aria-hidden="true" /> Add {{ config.singular }}</button>
          </div>
        </div>

        <p v-if="loading" role="status">Loading records…</p>
        <div v-else-if="loadError" role="alert"><p>{{ loadError }}</p><button type="button" class="ws-button" @click="load">Retry</button></div>
        <div v-else class="ws-table-wrap">
          <table class="ws-table co-list">
            <thead><tr><th v-for="column in config.columns" :key="column.label" scope="col" :class="{ 'ws-num': column.numeric, 'co-list__center': column.check }">{{ column.label }}</th></tr></thead>
            <tbody>
              <tr v-for="record in visible" :key="record.id" class="co-list__row" @click="openForm(record)">
                <td v-for="(column, index) in config.columns" :key="column.label" :class="{ 'ws-num': column.numeric, 'co-list__center': column.check }">
                  <button v-if="index === 0" class="co-list__link" type="button" :aria-label="`Open ${config.label(record)}`" @click.stop="openForm(record)">{{ column.value(record) }}</button>
                  <span v-else-if="column.check" class="co-check" :class="{ 'co-check--on': column.check(record) }" role="img" :aria-label="`${column.label} ${column.check(record) ? 'yes' : 'no'}`"><Check v-if="column.check(record)" :size="13" :stroke-width="3" aria-hidden="true" /></span>
                  <span v-else-if="column.badge" class="ws-badge" :class="`ws-badge--${column.badge(record).tone}`">{{ column.badge(record).text }}</span>
                  <strong v-else-if="column.strong">{{ column.value(record) }}</strong>
                  <template v-else>{{ column.value(record) }}</template>
                  <small v-if="column.sub && column.sub(record)">{{ column.sub(record) }}</small>
                </td>
              </tr>
              <tr v-if="!visible.length" class="co-list__empty">
                <td :colspan="config.columns.length">
                  <strong>{{ records.length ? `No ${config.plural} match` : 'No rows to show' }}</strong>
                  <span>{{ records.length ? 'Try another search or status.' : `Add your first ${config.singular} to get started.` }}</span>
                </td>
              </tr>
            </tbody>
            <tfoot><tr><td :colspan="config.columns.length"><span>{{ visible.length }}</span><span v-if="config.footer" class="co-list__footnote">{{ config.footer(records) }}</span></td></tr></tfoot>
          </table>
        </div>
      </div>
    </div>

    <dialog ref="formDialog" class="ws-dialog" :class="{ 'ws-dialog--wide': preview }" :aria-label="`${draft.id ? 'Edit' : 'Add'} ${config.singular}`" @cancel="busy && $event.preventDefault()">
      <form novalidate @submit.prevent="save">
        <div class="ws-dialog__header"><h2>{{ draft.id ? 'Edit' : 'Add' }} {{ config.singular }}</h2><button class="ws-icon-button" type="button" :disabled="busy" aria-label="Close" @click="formDialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div ref="formBody" class="ws-dialog__body">
          <div class="co-form-layout" :class="{ 'co-form-layout--preview': preview }">
            <fieldset class="ws-form" :disabled="busy || !can(draft.id ? 'edit' : 'create')" style="margin: 0; padding: 0; border: 0; min-width: 0">
              <RecordField v-for="field in visibleFields" :id="fieldId(field)" :key="field.key" v-model="draft[field.key]" :field="field" />
            </fieldset>
            <aside v-if="preview" class="co-preview" aria-label="Preview">
              <span class="co-preview__label">Preview</span>
              <strong v-if="preview.heading">{{ preview.heading }}</strong>
              <p>{{ preview.body }}</p>
            </aside>
          </div>
          <p v-if="formError" class="ws-form-error" role="alert">{{ formError }}</p>
        </div>
        <div class="ws-dialog__footer">
          <button v-if="draft.id && can('delete')" class="ws-button co-button--ghost-danger" type="button" :disabled="busy" @click="deleteFromForm"><Trash2 :size="15" aria-hidden="true" /> {{ config.singular === 'user' ? 'Deactivate' : 'Delete' }}</button>
          <button class="ws-button" type="button" :disabled="busy" @click="formDialog?.close()">Cancel</button>
          <button v-if="can(draft.id ? 'edit' : 'create')" class="ws-button ws-button--primary" type="submit" :disabled="busy">{{ busy ? 'Saving…' : draft.id ? 'Save changes' : `Add ${config.singular}` }}</button>
        </div>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="ws-dialog ws-dialog--small" aria-label="Confirm deletion" @cancel="busy && $event.preventDefault()" @close="pendingDelete = null">
      <div class="ws-dialog__header"><h2>{{ config.singular === 'user' ? 'Deactivate user' : `Delete ${config.singular}` }}?</h2></div>
      <div class="ws-dialog__body"><p><strong>{{ pendingDelete ? config.label(pendingDelete) : '' }}</strong>: {{ config.singular === 'user' ? 'This account will lose access. An administrator can reactivate it later.' : 'This record will be removed. This cannot be undone.' }}</p></div>
      <p v-if="formError" class="ws-form-error" role="alert">{{ formError }}</p>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" :disabled="busy" @click="deleteDialog?.close()">Cancel</button><button class="ws-button ws-button--danger" type="button" :disabled="busy" @click="confirmDelete">{{ config.singular === 'user' ? 'Deactivate' : 'Delete' }}</button></div>
    </dialog>
  </section>
</template>
