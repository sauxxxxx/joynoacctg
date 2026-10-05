<script setup lang="ts">
import { computed, ref } from 'vue'
import { Download, FileText, Info, Plus, Search, Trash2, Upload, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { documentRepository } from '../../services/previewRepositories'
import { recordAudit, storedDocuments, type StoredDocument } from './companyStore'
import '../workspace/workspace.css'
import './company.css'

const maxBytes = 10 * 1024 * 1024
const categories = ['Registration', 'Tax filing', 'Contract', 'Bank', 'Receipt', 'Other']
const categoryOptions = categories.map((value) => ({ value, label: value }))

const search = ref('')
const category = ref('')
const notice = ref('')
const error = ref('')
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
  file.value = null
  draft.value = { name: '', category: 'Other', reference: '', notes: '' }
  error.value = ''
  uploadDialog.value?.showModal()
}

function choose(files: FileList | null | undefined) {
  const picked = files?.[0]
  if (!picked) return
  if (picked.size > maxBytes) {
    error.value = `${picked.name} is ${size(picked.size)}. Files can be up to 10 MB.`
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
  if (!file.value) { error.value = 'Choose a file to upload.'; return }
  const name = draft.value.name.trim()
  if (!name) { error.value = 'Document name is required.'; return }
  const document: StoredDocument = {
    id: crypto.randomUUID(),
    name,
    fileName: file.value.name,
    size: file.value.size,
    mimeType: file.value.type || 'application/octet-stream',
    category: draft.value.category,
    reference: draft.value.reference.trim(),
    notes: draft.value.notes.trim(),
    uploadedAt: new Date().toISOString(),
    url: URL.createObjectURL(file.value),
  }
  await documentRepository.save(document)
  recordAudit('Documents', 'Created', `Document: ${name}`, `${document.fileName} · ${size(document.size)}`)
  notice.value = `${name} uploaded.`
  uploadDialog.value?.close()
}

function askDelete(document: StoredDocument) {
  pendingDelete.value = document
  deleteDialog.value?.showModal()
}

async function confirmDelete() {
  const document = pendingDelete.value
  if (!document) return
  URL.revokeObjectURL(document.url)
  await documentRepository.remove(document.id)
  recordAudit('Documents', 'Deleted', `Document: ${document.name}`, document.fileName)
  notice.value = `${document.name} deleted.`
  deleteDialog.value?.close()
}

</script>

<template>
  <section class="ws-page co-page" aria-label="Documents">
    <div class="ws-stack">
      <p class="co-intro">Keep registrations, filings, contracts, and other supporting files in one place.</p>
      <p class="ws-note"><Info :size="14" aria-hidden="true" />Files stay in this browser tab and are removed when it reloads. Cloud storage comes with the backend.</p>
      <p v-if="notice" class="ws-notice" role="status">{{ notice }}</p>

      <div class="ws-panel ws-panel--clip">
        <div class="ws-toolbar">
          <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Search documents" aria-label="Search documents" /></label>
          <div class="ws-toolbar__field"><AppSelect id="documents-category" v-model="category" aria-label="Category" :options="filterOptions" /></div>
          <span class="ws-toolbar__spacer" />
          <button class="ws-button ws-button--primary" type="button" @click="openUpload"><Plus :size="16" aria-hidden="true" /> Upload document</button>
        </div>
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
                  <a class="ws-icon-button" :href="item.url" :download="item.fileName" :aria-label="`Download ${item.name}`"><Download :size="15" aria-hidden="true" /></a>
                  <button class="ws-icon-button ws-icon-button--danger" type="button" :aria-label="`Delete ${item.name}`" @click="askDelete(item)"><Trash2 :size="15" aria-hidden="true" /></button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="ws-empty">
          <span class="ws-empty__icon"><FileText :size="22" aria-hidden="true" /></span>
          <strong>{{ storedDocuments.length ? 'No documents match' : 'No documents yet' }}</strong>
          <span>{{ storedDocuments.length ? 'Try another search or category.' : 'Upload a file to start your document library.' }}</span>
          <button v-if="!storedDocuments.length" class="ws-button" type="button" @click="openUpload"><Upload :size="15" aria-hidden="true" /> Upload document</button>
        </div>
        <div class="ws-panel__footer"><span>{{ visible.length }} of {{ storedDocuments.length }} documents</span></div>
      </div>
    </div>

    <dialog ref="uploadDialog" class="ws-dialog" aria-label="Upload document">
      <form @submit.prevent="save">
        <div class="ws-dialog__header"><h2>Upload document</h2><button class="ws-icon-button" type="button" aria-label="Close" @click="uploadDialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div class="ws-dialog__body">
          <label v-if="!file" class="co-dropzone" :class="{ 'co-dropzone--active': dragging }" @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop">
            <input type="file" @change="choose(($event.target as HTMLInputElement).files)" />
            <Upload :size="20" aria-hidden="true" />
            <span>Drag and drop a file here, or <u>browse</u></span>
            <small>Up to 10 MB</small>
          </label>
          <div v-else class="co-file"><FileText :size="18" aria-hidden="true" /><span>{{ file.name }} · {{ size(file.size) }}</span><button class="ws-icon-button" type="button" aria-label="Remove file" @click="file = null"><X :size="15" aria-hidden="true" /></button></div>
          <div class="ws-form">
            <label class="ws-field ws-form__full"><span>Document name<em> *</em></span><input v-model="draft.name" maxlength="160" required /></label>
            <div class="ws-field"><AppSelect id="document-category" v-model="draft.category" label="Category" :options="categoryOptions" /></div>
            <label class="ws-field"><span>Reference</span><input v-model="draft.reference" maxlength="80" placeholder="e.g. COR number, contract no." /></label>
            <label class="ws-field ws-form__full"><span>Notes</span><textarea v-model="draft.notes" maxlength="500" rows="3" /></label>
          </div>
          <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        </div>
        <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="uploadDialog?.close()">Cancel</button><button class="ws-button ws-button--primary" type="submit">Upload</button></div>
      </form>
    </dialog>

    <dialog ref="deleteDialog" class="ws-dialog ws-dialog--small" aria-label="Confirm deletion" @close="pendingDelete = null">
      <div class="ws-dialog__header"><h2>Delete document?</h2></div>
      <div class="ws-dialog__body"><p>Remove <strong>{{ pendingDelete?.name }}</strong>? This cannot be undone.</p></div>
      <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="deleteDialog?.close()">Cancel</button><button class="ws-button ws-button--danger" type="button" @click="confirmDelete">Delete</button></div>
    </dialog>
  </section>
</template>
