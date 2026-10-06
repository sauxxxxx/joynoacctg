<script setup lang="ts">
import AppDataState from '../../components/ui/AppDataState.vue'
import { computed, onMounted, ref, watch } from 'vue'
import { Archive, Download, FileText, Plus, RotateCcw, Search, Upload, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { documentRepository } from '../../services/previewRepositories'
import { storedDocuments, type StoredDocument } from './companyStore'
import { downloadDocument, restoreDocument, uploadDocument } from './privateDocuments'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'
import { errorMessage } from '../../services/api/errors'
import { getApiCredentials } from '../../services/api/session'
import '../workspace/workspace.css'
import './company.css'

const maxBytes = 10 * 1024 * 1024
const categories = ['Registration', 'Tax filing', 'Contract', 'Bank', 'Receipt', 'Other']
const categoryOptions = categories.map((value) => ({ value, label: value }))

const search = ref('')
const category = ref('')
const notice = ref('')
const error = ref('')
const loading = ref(true)
const busy = ref(false)
const archived = ref(false)
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
let generation = 0

async function load() {
  const current = ++generation
  const token = getApiCredentials()?.accessToken
  loading.value = true; error.value = ''
  try {
    const records = await documentRepository.listAll({ filters: { archived: String(archived.value) } })
    if (current === generation && token === getApiCredentials()?.accessToken) storedDocuments.value = records
  } catch (cause) { if (current === generation) error.value = errorMessage(cause, 'Documents could not be loaded.') }
  finally { if (current === generation) loading.value = false }
}
onMounted(load)
watch(archived, load)
const dragging = ref(false)
const uploadDialog = ref<HTMLDialogElement | null>(null)
const deleteDialog = ref<HTMLDialogElement | null>(null)
const pendingDelete = ref<StoredDocument | null>(null)
const file = ref<File | null>(null)
const draft = ref({ name: '', category: 'Other', reference: '', notes: '' })

const filterOptions = computed(() => [{ value: '', label: 'All categories' }, ...categoryOptions])
const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return storedDocuments.value.filter((item) => (!category.value || item.category === category.value)
    && (!term || `${item.name} ${item.fileName} ${item.reference} ${item.notes}`.toLocaleLowerCase().includes(term)))
})
const dateTime = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

function size(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function openUpload() {
  if (busy.value || loading.value || !can('Documents', 'create')) return
  file.value = null
  draft.value = { name: '', category: 'Other', reference: '', notes: '' }
  error.value = ''
  uploadDialog.value?.showModal()
}

function choose(files: FileList | null | undefined) {
  if (busy.value) return
  const picked = files?.[0]
  if (!picked) return
  if (!picked.size || picked.size > maxBytes || !/\.(pdf|png|jpe?g|webp)$/i.test(picked.name)) {
    error.value = 'Choose a non-empty PDF, PNG, JPEG, or WebP file up to 10 MB.'
    return
  }
  error.value = ''
  file.value = picked
  if (!draft.value.name.trim()) draft.value.name = picked.name.replace(/\.[^.]+$/, '')
}

function onDrop(event: DragEvent) {
  dragging.value = false
  choose(event.dataTransfer?.files)
}

async function save() {
  if (busy.value || !can('Documents', 'create')) return
  if (!file.value) { error.value = 'Choose a file to upload.'; return }
  const name = draft.value.name.trim()
  if (!name) { error.value = 'Document name is required.'; return }
  busy.value = true; error.value = ''
  try {
    await uploadDocument(file.value, { name, category: draft.value.category, reference: draft.value.reference.trim(), notes: draft.value.notes.trim() })
    notice.value = `${name} uploaded.`; uploadDialog.value?.close()
    archived.value = false; await load()
  } catch (cause) { error.value = errorMessage(cause, 'The file could not be uploaded.'); }
  finally { busy.value = false }
}

function askDelete(document: StoredDocument) {
  if (busy.value || !can('Documents', 'delete')) return
  pendingDelete.value = document
  deleteDialog.value?.showModal()
}

async function confirmDelete() {
  const document = pendingDelete.value
  if (!document || busy.value || !can('Documents', 'delete')) return
  busy.value = true; error.value = ''
  try {
    await documentRepository.remove(document.id, document.version)
    notice.value = `${document.name} archived.`; deleteDialog.value?.close(); await load()
  } catch (cause) { error.value = errorMessage(cause, 'The file could not be archived.') }
  finally { busy.value = false }
}

async function fileAction(document: StoredDocument, restore = false) {
  if (busy.value || (restore && !can('Documents', 'edit'))) return
  busy.value = true; error.value = ''
  try {
    if (restore) { await restoreDocument(document); notice.value = `${document.name} restored.`; await load() }
    else await downloadDocument(document)
  } catch (cause) { error.value = errorMessage(cause, 'The file action could not be completed.') }
  finally { busy.value = false }
}

</script>

<template>
  <section class="ws-page co-page" aria-label="Documents">
    <div class="ws-stack">
      <p class="co-intro">Keep registrations, filings, contracts, and other supporting files in one place.</p>
      <p class="co-intro">Private PDFs and images, up to 10 MB each. Archived files remain available to restore.</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>

      <div class="ws-panel ws-panel--clip">
        <div class="ws-toolbar">
          <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search documents" aria-label="Search documents" /></label>
          <div class="ws-toolbar__field"><AppSelect id="documents-category" v-model="category" aria-label="Category" :options="filterOptions" /></div>
          <span class="ws-toolbar__spacer" />
          <label><input v-model="archived" type="checkbox" :disabled="busy" /> Archived</label>
          <button v-if="can('Documents', 'create')" class="ws-button ws-button--primary" type="button" :disabled="loading || busy" @click="openUpload"><Plus :size="16" aria-hidden="true" /> Upload document</button>
        </div>
        <AppDataState :loading="loading" :error="error" :empty="!visible.length" label="Documents" :empty-title="storedDocuments.length ? 'No matching documents' : archived ? 'No archived documents' : 'No documents yet'" empty-message="Your uploaded files will appear here. Try another search or category." @retry="load">
        <div v-if="visible.length" class="ws-table-wrap">
          <table class="ws-table">
            <thead><tr><th scope="col">Document</th><th scope="col">Category</th><th scope="col">Reference</th><th scope="col" class="ws-num">Size</th><th scope="col">Uploaded</th><th scope="col" class="ws-actions">Actions</th></tr></thead>
            <tbody>
              <tr v-for="item in visible" :key="item.id">
                <td><strong>{{ item.name }}</strong><small>{{ item.fileName }}</small></td>
                <td>{{ item.category }}</td>
                <td>{{ item.reference || '—' }}</td>
                <td class="ws-num">{{ size(item.size) }}</td>
                <td class="ws-nowrap">{{ dateTime.format(new Date(item.uploadedAt)) }}</td>
                <td class="ws-actions">
                  <button class="ws-icon-button" type="button" :disabled="busy" :aria-label="`Download ${item.name}`" @click="fileAction(item)"><Download :size="15" aria-hidden="true" /></button>
                  <button v-if="item.archived && can('Documents', 'edit')" class="ws-icon-button" type="button" :disabled="busy" :aria-label="`Restore ${item.name}`" @click="fileAction(item, true)"><RotateCcw :size="15" aria-hidden="true" /></button>
                  <button v-if="!item.archived && can('Documents', 'delete')" class="ws-icon-button ws-icon-button--danger" type="button" :disabled="busy" :aria-label="`Archive ${item.name}`" @click="askDelete(item)"><Archive :size="15" aria-hidden="true" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="ws-panel__footer"><span>{{ visible.length }} of {{ storedDocuments.length }} documents</span></div>
        </AppDataState>
      </div>
    </div>

    <dialog ref="uploadDialog" class="ws-dialog" aria-label="Upload document" @cancel="busy && $event.preventDefault()">
      <form @submit.prevent="save">
        <div class="ws-dialog__header"><h2>Upload document</h2><button class="ws-icon-button" type="button" aria-label="Close" :disabled="busy" @click="uploadDialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div class="ws-dialog__body">
          <label v-if="!file" class="co-dropzone" :class="{ 'co-dropzone--active': dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
            <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" :disabled="busy" @change="choose(($event.target as HTMLInputElement).files)" />
            <Upload :size="20" aria-hidden="true" />
            <span>Drag and drop a file here, or <u>browse</u></span>
            <small>PDF, PNG, JPEG, or WebP · Up to 10 MB</small>
          </label>
          <div v-else class="co-file"><FileText :size="18" aria-hidden="true" /><span>{{ file.name }} · {{ size(file.size) }}</span><button class="ws-icon-button" type="button" :disabled="busy" aria-label="Remove file" @click="file = null"><X :size="15" aria-hidden="true" /></button></div>
          <fieldset class="ws-form" :disabled="busy" style="border: 0; padding: 0; margin: 0">
            <label class="ws-field ws-form__full"><span>Document name<em> *</em></span><input v-model="draft.name" maxlength="160" required /></label>
            <div class="ws-field"><AppSelect id="document-category" v-model="draft.category" label="Category" :options="categoryOptions" /></div>
            <label class="ws-field"><span>Reference</span><input v-model="draft.reference" maxlength="80" placeholder="e.g. COR number, contract no." /></label>
            <label class="ws-field ws-form__full"><span>Notes</span><textarea v-model="draft.notes" maxlength="500" rows="3" /></label>
          </fieldset>
          <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        </div>
        <div class="ws-dialog__footer"><button class="ws-button" type="button" :disabled="busy" @click="uploadDialog?.close()">Cancel</button><button class="ws-button ws-button--primary" type="submit" :disabled="busy">{{ busy ? 'Uploading…' : 'Upload' }}</button></div>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="ws-dialog ws-dialog--small" aria-label="Archive document" @close="pendingDelete = null" @cancel="busy && $event.preventDefault()">
      <div class="ws-dialog__header"><h2>Archive document?</h2></div>
      <div class="ws-dialog__body"><p>Archive <strong>{{ pendingDelete?.name }}</strong>? The file stays saved and can be restored.</p><p v-if="error" class="ws-form-error" role="alert">{{ error }}</p></div>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" :disabled="busy" @click="deleteDialog?.close()">Cancel</button><button class="ws-button ws-button--danger" type="button" :disabled="busy" @click="confirmDelete">{{ busy ? 'Archiving…' : 'Archive' }}</button></div>
    </dialog>
  </section>
</template>
