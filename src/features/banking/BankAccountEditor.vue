<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import { emptyBankAccount, type BankAccountRecord } from './bankingData'

const props = defineProps<{ open: boolean; record: BankAccountRecord | null }>()
const emit = defineEmits<{ close: []; save: [record: BankAccountRecord]; delete: [record: BankAccountRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyBankAccount())
const error = ref('')

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyBankAccount()
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  if (!draft.value.name.trim()) { error.value = 'Enter a name for this bank account.'; return }
  if (!draft.value.ledgerAccount.trim()) { error.value = 'Choose the ledger account used for transactions.'; return }
  emit('save', {
    ...draft.value,
    id: draft.value.id || crypto.randomUUID(),
    name: draft.value.name.trim(),
    bank: draft.value.bank.trim(),
    accountNumber: draft.value.accountNumber.trim(),
    ledgerAccount: draft.value.ledgerAccount.trim(),
    remarks: draft.value.remarks.trim(),
  })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="banking-editor" :aria-label="`${record ? 'Edit' : 'New'} bank account`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit bank account' : 'New bank account' }}</h2><p>Connect the bank record to the ledger account used in transactions.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="banking-editor__fields">
        <label>Name <span>*</span><input v-model="draft.name" required maxlength="140" placeholder="e.g. JOYNO INC" /></label>
        <label>Account number<input v-model="draft.accountNumber" maxlength="80" inputmode="numeric" /></label>
        <label>Bank<input v-model="draft.bank" maxlength="140" placeholder="Bank name" /></label>
        <label>Account to use in transactions <span>*</span><input v-model="draft.ledgerAccount" required maxlength="120" /></label>
        <label class="banking-editor__wide">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="300" /></label>
        <label class="banking-editor__check"><input v-model="draft.active" type="checkbox" /> This bank account is active</label>
        <p v-if="error" class="banking-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button v-if="draft.id" class="banking-button banking-button--danger" type="button" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="banking-button" type="button" @click="dialog?.close()">Cancel</button><button class="banking-button banking-button--primary" type="submit">Save account</button></footer>
    </form>
  </dialog>
</template>
