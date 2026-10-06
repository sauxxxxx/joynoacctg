<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Trash2, X } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { formatMoney, parseMoneyToCents } from '../../lib/money'
import { useSubmit } from '../../lib/useSubmit'
import { accountOptions, findAccount } from '../accounting/setup/accountSetupData'
import { bankAccounts, emptyBankTransaction, type BankTransactionRecord } from './bankingData'

const props = defineProps<{ open: boolean; record: BankTransactionRecord | null; save: (record: BankTransactionRecord) => Promise<void>; readonly?: boolean; canDelete?: boolean; canVoid?: boolean; busy?: boolean }>()
const emit = defineEmits<{ close: []; delete: [record: BankTransactionRecord]; void: [record: BankTransactionRecord] }>()
const dialog = ref<HTMLDialogElement | null>(null)
const draft = ref(emptyBankTransaction())
const amount = ref('0.00')
const localError = ref('')
const submit = useSubmit()
const readOnly = computed(() => Boolean(props.readonly) || draft.value.status !== 'Draft')
const bankOptions = computed(() => bankAccounts.value.filter((item) => item.active || item.id === draft.value.bankAccountId).map((account) => ({ value: account.id, label: `${account.name} · ${account.bank}` })))
const partyTypeOptions = ['Vendor', 'Customer', 'Employee', 'Other'].map((value) => ({ value, label: value }))
const directionOptions = [{ value: 'Disbursement', label: 'Money out (payment, withdrawal)' }, { value: 'Receipt', label: 'Money in (deposit, collection)' }]
const error = computed(() => localError.value || submit.error.value)
const fieldError = (field: string) => submit.fieldErrors.value[field]?.[0] ?? ''

watch(() => [props.open, props.record] as const, async ([open]) => {
  draft.value = props.record ? { ...props.record } : emptyBankTransaction()
  if (!draft.value.bankAccountId && bankAccounts.value.length === 1) draft.value.bankAccountId = bankAccounts.value[0]!.id
  amount.value = props.record ? formatMoney(props.record.amountCents).replaceAll(',', '') : '0.00'
  localError.value = ''
  submit.reset()
  await nextTick()
  if (open && !dialog.value?.open) dialog.value?.showModal()
  if (!open && dialog.value?.open) dialog.value.close()
}, { immediate: true })

async function submitForm() {
  if (readOnly.value || props.busy || submit.pending.value) return
  localError.value = ''
  const amountCents = parseMoneyToCents(amount.value)
  if (!draft.value.bankAccountId) { localError.value = 'Choose a bank account.'; return }
  if (!draft.value.date) { localError.value = 'Choose a transaction date.'; return }
  if (!draft.value.purpose.trim()) { localError.value = 'Enter the purpose of the transaction.'; return }
  if (!findAccount(draft.value.ledgerAccountId)?.active) { localError.value = 'Choose the related ledger account.'; return }
  if (!draft.value.partyType.trim()) { localError.value = 'Choose a party type.'; return }
  if (amountCents === null || amountCents <= 0) { localError.value = 'Enter an amount greater than zero.'; return }
  const saved = await submit.run(() => props.save({
    ...draft.value, amountCents,
    purpose: draft.value.purpose.trim(),
    party: draft.value.party.trim(), reference: draft.value.reference.trim(), description: draft.value.description.trim(),
  }), 'The bank transaction could not be saved.')
  if (saved) emit('close')
}
</script>

<template>
  <dialog ref="dialog" class="banking-editor banking-editor--wide" :aria-label="`${record ? 'Edit' : 'New'} bank transaction`" @close="emit('close')" @cancel="(busy || submit.pending.value) && $event.preventDefault()">
    <form @submit.prevent="submitForm">
      <header><div><h2>{{ readOnly ? 'Bank transaction' : record ? 'Edit bank transaction' : 'New bank transaction' }}</h2><p>{{ draft.status !== 'Draft' ? `This transaction is ${draft.status.toLocaleLowerCase()} and is read-only.` : 'Draft transactions can be reviewed and journalized from the Unjournalized tab.' }}</p></div><button type="button" aria-label="Close form" :disabled="busy || submit.pending.value" @click="dialog?.close()"><X :size="18" /></button></header>
      <fieldset class="banking-editor__fields" :disabled="readOnly || busy || submit.pending.value">
        <AppSelect id="bank-transaction-bank" v-model="draft.bankAccountId" label="Bank account" required placeholder="Choose bank account" :options="bankOptions" :invalid="Boolean((error && !draft.bankAccountId) || fieldError('bankAccountId'))" described-by="bank-transaction-error" />
        <AppDatePicker v-model="draft.date" label="Date" required :invalid="Boolean((error && !draft.date) || fieldError('date'))" />
        <AppSelect id="bank-transaction-direction" v-model="draft.direction" label="Direction" required :options="directionOptions" described-by="bank-transaction-error" />
        <label>Purpose <span>*</span><input v-model="draft.purpose" maxlength="120" placeholder="e.g. Supplier payment" :aria-invalid="Boolean(fieldError('purpose'))" /></label>
        <AppSelect id="bank-transaction-account" v-model="draft.ledgerAccountId" label="Account" required placeholder="Choose account" :options="accountOptions(draft.ledgerAccountId)" :invalid="Boolean((error && !draft.ledgerAccountId) || fieldError('ledgerAccountId'))" described-by="bank-transaction-error" />
        <AppSelect id="bank-transaction-party-type" v-model="draft.partyType" label="Party type" required placeholder="Choose party type" :options="partyTypeOptions" :invalid="Boolean(error && !draft.partyType)" described-by="bank-transaction-error" />
        <label>Party<input v-model="draft.party" maxlength="140" placeholder="Optional name" /></label>
        <label>Amount <span>*</span><input v-model="amount" inputmode="decimal" placeholder="0.00" :aria-invalid="Boolean(fieldError('amountCents'))" /></label>
        <label>Reference #<input v-model="draft.reference" maxlength="80" /></label>
        <label class="banking-editor__wide">Description<textarea v-model="draft.description" rows="3" maxlength="300" /></label>
        <p v-if="error" id="bank-transaction-error" class="banking-editor__error" role="alert">{{ error }}</p>
      </fieldset>
      <footer><button v-if="draft.id && draft.status === 'Draft' && canDelete" class="banking-button banking-button--danger" type="button" :disabled="busy || submit.pending.value" @click="emit('delete', draft)"><Trash2 :size="15" /> Delete</button><button v-if="draft.status === 'Journalized' && canVoid" class="banking-button banking-button--danger" type="button" :disabled="busy || submit.pending.value" @click="emit('void', draft)">Void transaction</button><span /><button class="banking-button" type="button" :disabled="busy || submit.pending.value" @click="dialog?.close()">{{ readOnly ? 'Close' : 'Cancel' }}</button><button v-if="!readOnly" class="banking-button banking-button--primary" type="submit" :disabled="busy || submit.pending.value">{{ submit.pending.value ? 'Saving…' : 'Save transaction' }}</button></footer>
    </form>
  </dialog>
</template>
