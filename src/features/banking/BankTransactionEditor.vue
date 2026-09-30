<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { bankAccounts, emptyBankTransaction, type BankTransactionRecord } from './bankingData'

const props = defineProps<{ open: boolean; record: BankTransactionRecord | null }>()
const emit = defineEmits<{ close: []; save: [record: BankTransactionRecord]; delete: [record: BankTransactionRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyBankTransaction())
const amount = ref('0.00')
const error = ref('')

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyBankTransaction()
  if (!draft.value.bankAccountId && bankAccounts.value.length === 1) draft.value.bankAccountId = bankAccounts.value[0]!.id
  amount.value = props.record ? formatMoney(props.record.amountCents).replaceAll(',', '') : '0.00'
  error.value = ''
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

function save() {
  const amountCents = parseMoneyToCents(amount.value)
  if (!draft.value.bankAccountId) { error.value = 'Choose a bank account.'; return }
  if (!draft.value.date) { error.value = 'Choose a transaction date.'; return }
  if (!draft.value.purpose.trim()) { error.value = 'Enter the purpose of the transaction.'; return }
  if (!draft.value.ledgerAccount.trim()) { error.value = 'Choose the related ledger account.'; return }
  if (!draft.value.partyType.trim()) { error.value = 'Choose a party type.'; return }
  if (amountCents === null || amountCents <= 0) { error.value = 'Enter an amount greater than zero.'; return }
  emit('save', {
    ...draft.value, id: draft.value.id || crypto.randomUUID(), amountCents,
    purpose: draft.value.purpose.trim(), ledgerAccount: draft.value.ledgerAccount.trim(),
    party: draft.value.party.trim(), reference: draft.value.reference.trim(), description: draft.value.description.trim(),
  })
  emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="banking-editor banking-editor--wide" :aria-label="`${record ? 'Edit' : 'New'} bank transaction`" @close="emit('close')">
    <form @submit.prevent="save">
      <header><div><h2>{{ record ? 'Edit bank transaction' : 'New bank transaction' }}</h2><p>Draft transactions can be reviewed and journalized from the Unjournalized tab.</p></div><button type="button" aria-label="Close form" @click="dialog?.close()"><X :size="18" /></button></header>
      <div class="banking-editor__fields">
        <label>Bank account <span>*</span><select v-model="draft.bankAccountId"><option value="" disabled>Select account</option><option v-for="account in bankAccounts.filter((item) => item.active)" :key="account.id" :value="account.id">{{ account.name }} · {{ account.bank }}</option></select></label>
        <AppDatePicker v-model="draft.date" label="Date" required :invalid="Boolean(error && !draft.date)" />
        <label>Purpose <span>*</span><input v-model="draft.purpose" maxlength="120" placeholder="e.g. Supplier payment" /></label>
        <label>Account <span>*</span><input v-model="draft.ledgerAccount" maxlength="120" placeholder="Ledger account" /></label>
        <label>Party type <span>*</span><select v-model="draft.partyType"><option value="" disabled>Select party type</option><option>Vendor</option><option>Customer</option><option>Employee</option><option>Other</option></select></label>
        <label>Party<input v-model="draft.party" maxlength="140" placeholder="Optional name" /></label>
        <label>Amount <span>*</span><input v-model="amount" inputmode="decimal" placeholder="0.00" /></label>
        <label>Reference #<input v-model="draft.reference" maxlength="80" /></label>
        <label class="banking-editor__wide">Description<textarea v-model="draft.description" rows="3" maxlength="300" /></label>
        <p v-if="error" class="banking-editor__error" role="alert">{{ error }}</p>
      </div>
      <footer><button v-if="draft.id" class="banking-button banking-button--danger" type="button" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><span /><button class="banking-button" type="button" @click="dialog?.close()">Cancel</button><button class="banking-button banking-button--primary" type="submit">Save transaction</button></footer>
    </form>
  </dialog>
</template>
