<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { useSubmit } from '../../lib/useSubmit'
import { accountOptions, findAccount } from '../accounting/setup/accountSetupData'
import { emptyBankAccount, type BankAccountRecord } from './bankingData'

const props = defineProps<{ open: boolean; record: BankAccountRecord | null; save: (record: BankAccountRecord) => Promise<void> }>()
const emit = defineEmits<{ close: []; delete: [record: BankAccountRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyBankAccount())
const localError = ref('')
const submit = useSubmit()

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyBankAccount()
  localError.value = ''
  submit.reset()
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

const fieldError = (field: string) => submit.fieldErrors.value[field]?.[0] ?? ''

async function submitForm() {
  localError.value = ''
  if (!draft.value.name.trim()) { localError.value = 'Enter a name for this bank account.'; return }
  if (!findAccount(draft.value.ledgerAccountId)?.active) { localError.value = 'Choose the ledger account used for transactions.'; return }
  const saved = await submit.run(() => props.save({
    ...draft.value,
    name: draft.value.name.trim(),
    bank: draft.value.bank.trim(),
    accountNumber: draft.value.accountNumber.trim(),
    remarks: draft.value.remarks.trim(),
  }), 'The bank account could not be saved.')
  if (saved) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="banking-editor" :aria-label="`${record ? 'Edit' : 'New'} bank account`" @close="emit('close')">
    <form @submit.prevent="submitForm">
      <header><div><h2>{{ record ? 'Edit bank account' : 'New bank account' }}</h2><p>Connect the bank record to the ledger account used in transactions.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="banking-editor__fields">
        <label>Name <span>*</span><input v-model="draft.name" required maxlength="140" placeholder="e.g. JOYNO INC" :aria-invalid="Boolean(fieldError('name'))" /></label>
        <label>Account number<input v-model="draft.accountNumber" maxlength="80" inputmode="numeric" :aria-invalid="Boolean(fieldError('accountNumber'))" /></label>
        <label>Bank<input v-model="draft.bank" maxlength="140" placeholder="Bank name" /></label>
        <AppSelect v-model="draft.ledgerAccountId" label="Account to use in transactions" required placeholder="Choose account" :options="accountOptions(draft.ledgerAccountId)" :invalid="Boolean((localError || fieldError('ledgerAccountId')) && !findAccount(draft.ledgerAccountId)?.active)" />
        <label class="banking-editor__wide">Remarks<textarea v-model="draft.remarks" rows="3" maxlength="300" /></label>
        <label class="banking-editor__check"><input v-model="draft.active" type="checkbox" /> This bank account is active</label>
        <p v-if="localError || submit.error.value" class="banking-editor__error" role="alert">{{ localError || submit.error.value }}</p>
      </div>
      <footer><button v-if="draft.id" class="banking-button banking-button--danger" type="button" :disabled="submit.pending.value" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="banking-button" type="button" @click="dialog?.close()">Cancel</button><button class="banking-button banking-button--primary" type="submit" :disabled="submit.pending.value">{{ submit.pending.value ? 'Saving…' : 'Save account' }}</button></footer>
    </form>
  </dialog>
</template>
