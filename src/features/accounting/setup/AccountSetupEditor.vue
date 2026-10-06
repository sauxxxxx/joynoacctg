<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { accountTypes, accounts, categories, type Account, type AccountCategory, type AccountType } from './accountSetupData'

const props = withDefaults(defineProps<{ open: boolean; kind: 'account' | 'category'; record: Account | AccountCategory | null; busy?: boolean; serverError?: string; canSave?: boolean; canDelete?: boolean }>(), { busy: false, serverError: '', canSave: true, canDelete: true })
const emit = defineEmits<{ close: []; delete: []; saveAccount: [record: Account]; saveCategory: [record: AccountCategory] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const error = ref('')
const draft = ref({ code: '', name: '', parentCode: '', type: 'Asset' as AccountType, mappedType: '', remarks: '', active: true, itr: '', legalBasis: '' })

const title = computed(() => `${props.record ? 'Edit' : 'Add'} ${props.kind === 'account' ? 'account' : 'category'}`)
const typeOptions = accountTypes.map((type) => ({ value: type, label: type }))
const categoryTypeOptions = [{ value: '', label: 'No type mapping' }, ...typeOptions]
const parentOptions = computed(() => {
  const options = [{ value: '', label: 'No parent' }]
  const descendants = new Set<string>()
  if (props.kind === 'category' && props.record) {
    descendants.add(props.record.code)
    let changed = true
    while (changed) {
      changed = false
      for (const category of categories.value) {
        if (descendants.has(category.parentCode) && !descendants.has(category.code)) { descendants.add(category.code); changed = true }
      }
    }
  }
  return [...options, ...categories.value.filter((category) => category.active && !descendants.has(category.code)).map((category) => ({ value: category.code, label: `${category.code} · ${category.name}` }))]
})

watch(() => [props.open, props.record, props.kind] as const, async () => {
  if (!props.open) { if (dialog.value?.open) dialog.value.close(); return }
  const record = props.record
  draft.value = {
    code: record?.code ?? '', name: record?.name ?? '', parentCode: record?.parentCode ?? '',
    type: record && 'type' in record ? record.type : 'Asset', mappedType: record && 'accountType' in record ? (record.accountType ?? '') : '', remarks: record?.remarks ?? '',
    active: record?.active ?? true, itr: record && 'itr' in record ? record.itr : '',
    legalBasis: record && 'legalBasis' in record ? record.legalBasis : '',
  }
  error.value = ''
  await nextTick()
  if (!dialog.value?.open) dialog.value?.showModal()
}, { immediate: true })

function save() {
  if (props.busy || !props.canSave) return
  error.value = ''
  const code = draft.value.code.trim().toUpperCase()
  const name = draft.value.name.trim()
  if (!code || !name) { error.value = 'Enter a code and name.'; return }
  if (!/^[A-Z0-9-]{1,24}$/.test(code)) { error.value = 'Use 1–24 letters, numbers, or hyphens for the code.'; return }
  if (props.kind === 'account') {
    if (accounts.value.some((item) => item.code === code && item.code !== props.record?.code)) { error.value = 'This account code already exists.'; return }
    if (!draft.value.parentCode || !categories.value.some((item) => item.code === draft.value.parentCode)) { error.value = 'Choose a valid parent category.'; return }
    emit('saveAccount', { id: props.record?.id ?? '', version: props.record?.version, code, name, parentCode: draft.value.parentCode, type: draft.value.type, remarks: draft.value.remarks.trim(), active: draft.value.active, itr: draft.value.itr.trim(), legalBasis: draft.value.legalBasis.trim() })
  } else {
    if (categories.value.some((item) => item.code === code && item.code !== props.record?.code)) { error.value = 'This category code already exists.'; return }
    if (draft.value.parentCode && !parentOptions.value.some((item) => item.value === draft.value.parentCode)) { error.value = 'Choose a valid parent category.'; return }
    emit('saveCategory', { id: props.record?.id ?? '', version: props.record?.version, code, name, parentCode: draft.value.parentCode, remarks: draft.value.remarks.trim(), active: draft.value.active, accountType: draft.value.mappedType ? draft.value.mappedType as AccountType : undefined })
  }
}
function close() { if (!props.busy) emit('close') }
</script>

<template>
  <dialog ref="dialog" class="setup-editor" :aria-label="title" :aria-busy="busy" @cancel.prevent="close" @click="($event) => { if ($event.target === dialog) close() }">
    <form @submit.prevent="save">
      <header class="setup-editor__header"><div><h2>{{ title }}</h2><p>Enter the details below, then save your changes.</p></div><button type="button" class="icon-button" aria-label="Close editor" :disabled="busy" @click="close"><X :size="18" /></button></header>
      <fieldset class="setup-editor__fields" :disabled="busy || !canSave">
        <label>Code <span aria-hidden="true">*</span><input v-model="draft.code" type="text" maxlength="24" :disabled="Boolean(record)" required /></label>
        <label>Name <span aria-hidden="true">*</span><input v-model="draft.name" type="text" maxlength="120" required /></label>
        <AppSelect v-model="draft.parentCode" :options="parentOptions" label="Parent category" :required="kind === 'account'" :disabled="busy || !canSave" />
        <AppSelect v-if="kind === 'account'" v-model="draft.type" :options="typeOptions" label="Account type" required :disabled="busy || !canSave" />
        <AppSelect v-else v-model="draft.mappedType" :options="categoryTypeOptions" label="Category type mapping" :disabled="busy || !canSave" />
        <label v-if="kind === 'account'">ITR<input v-model="draft.itr" type="text" maxlength="100" /></label>
        <label v-if="kind === 'account'">Legal basis<input v-model="draft.legalBasis" type="text" maxlength="160" /></label>
        <label class="setup-editor__wide">Remarks<textarea v-model="draft.remarks" rows="2" maxlength="240" /></label>
        <label class="setup-editor__check"><input v-model="draft.active" type="checkbox" />Active</label>
        <p v-if="error || serverError" class="setup-editor__error setup-editor__wide" role="alert">{{ error || serverError }}</p>
      </fieldset>
      <footer class="setup-editor__footer"><button v-if="record && canDelete" type="button" class="setup-button setup-button--danger" :disabled="busy" @click="emit('delete')">Delete</button><span class="setup-editor__footer-spacer" /><button type="button" class="setup-button" :disabled="busy" @click="close">Cancel</button><button v-if="canSave" type="submit" class="setup-button setup-button--primary" :disabled="busy">{{ busy ? 'Saving…' : `Save ${kind}` }}</button></footer>
    </form>
  </dialog>
</template>
