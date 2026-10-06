<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { useSubmit } from '../../lib/useSubmit'
import { parseMoneyToCents, formatMoney } from '../../lib/money'
import { http } from '../../services/api/httpClient'
import { useAuth } from '../auth/authStore'
import { usePermissions } from '../auth/permissions'
import { accountStore, accounts } from '../accounting/setup/accountSetupData'
import '../accounting/journals/journalPreview.css'

interface Source { id: string; version?: number; number: string; date: string; status: string; kind: string; journalEntryId?: string; amountCents?: number; totalCents?: number }
const props = defineProps<{ record: Source; domain: 'sales-documents' | 'purchases' }>()
const emit = defineEmits<{ changed: [message: string] }>()
const { authUser } = useAuth()
const { can } = usePermissions(authUser)
const mutation = useSubmit()
const dialog = ref<HTMLDialogElement | null>(null)
const mode = ref<'post' | 'void'>('post')
const reason = ref('')
const module = computed(() => props.domain === 'sales-documents' ? 'Sales' : 'Purchases')
const canEdit = computed(() => can(module.value, 'edit') && can('Accounting', 'edit'))
const postable = computed(() => !props.record.journalEntryId && !['Posted', 'Cancelled', 'Voided'].includes(props.record.status) && props.record.kind !== 'acknowledgement-receipts')
const voidable = computed(() => !['Cancelled', 'Voided'].includes(props.record.status) && (props.record.journalEntryId || props.record.status !== 'Draft'))
const amount = computed(() => props.domain === 'sales-documents' ? props.record.amountCents || 0 : props.record.totalCents || 0)
const lines = ref<{ accountId: string; debit: string; credit: string; remarks: string }[]>([])
const options = computed(() => accounts.value.filter((account) => account.active).map((account) => ({ value: account.id, label: `${account.code} · ${account.name}` })))
const totals = computed(() => lines.value.reduce((total, line) => ({ debit: total.debit + (parseMoneyToCents(line.debit || '0') || 0), credit: total.credit + (parseMoneyToCents(line.credit || '0') || 0) }), { debit: 0, credit: 0 }))
async function open(action: 'post' | 'void') {
  if (mutation.pending.value) return
  mutation.reset(); mode.value = action; reason.value = ''
  lines.value = [{ accountId: '', debit: (amount.value / 100).toFixed(2), credit: '', remarks: '' }, { accountId: '', debit: '', credit: (amount.value / 100).toFixed(2), remarks: '' }]
  await nextTick(); dialog.value?.showModal()
  if (action === 'post') await mutation.run(async () => {
    await accountStore.reload()
    if (accountStore.error.value) throw new Error(accountStore.error.value)
  }, 'Accounts could not be loaded. Close and try again.')
}
async function submit() {
  const ok = await mutation.run(async () => {
    if (!props.record.version) throw new Error('Reload this record before continuing.')
    let body: unknown = { expectedVersion: props.record.version, reason: reason.value.trim() }
    if (mode.value === 'post') {
      const parsed = lines.value.map((line) => {
        const debitCents = parseMoneyToCents(line.debit || '0'); const creditCents = parseMoneyToCents(line.credit || '0')
        if (!line.accountId || debitCents === null || creditCents === null || debitCents < 0 || creditCents < 0 || (debitCents > 0) === (creditCents > 0)) throw new Error('Choose an account and enter a positive debit or credit on every line.')
        return { accountId: line.accountId, debitCents, creditCents, remarks: line.remarks }
      })
      if (totals.value.debit !== amount.value || totals.value.credit !== amount.value) throw new Error('Both journal totals must match the document total.')
      body = { expectedVersion: props.record.version, lines: parsed }
    } else if (reason.value.trim().length < 3) throw new Error('Enter a reason for voiding this record.')
    await http.post(`/${props.domain}/${encodeURIComponent(props.record.id)}/${mode.value}`, body)
  })
  if (ok) { dialog.value?.close(); emit('changed', `${props.record.number} ${mode.value === 'post' ? 'posted' : 'voided'}.`) }
}
</script>

<template>
  <button v-if="canEdit && can('Accounting', 'create') && postable" type="button" class="sales-button purchases-button" @click="open('post')">Review and post</button>
  <button v-if="canEdit && voidable" type="button" class="sales-button purchases-button" @click="open('void')">Void record</button>
  <dialog ref="dialog" class="journal-editor" :aria-label="mode === 'post' ? 'Review document posting' : 'Void document'" @cancel.prevent="!mutation.pending.value && dialog?.close()">
    <form @submit.stop.prevent="submit">
      <header class="journal-editor__header"><div><h2>{{ mode === 'post' ? 'Review and post' : 'Void record' }} · {{ record.number }}</h2><p>{{ record.date }} · Total PHP {{ formatMoney(amount) }}</p></div></header>
      <fieldset class="journal-editor__body" :disabled="mutation.pending.value" style="border: 0; margin: 0; min-width: 0">
        <template v-if="mode === 'post'">
          <p>Choose the accounts for this document. Review VAT, withholding, and discounts against the source record; tax treatment is not calculated automatically. Posting locks the document and updates financial reports.</p>
          <div v-for="(line, index) in lines" :key="index" class="journal-editor__line">
            <AppSelect v-model="line.accountId" :label="`Line ${index + 1} account`" placeholder="Choose account" :options="options" required />
            <label>Debit<input v-model="line.debit" inputmode="decimal" /></label><label>Credit<input v-model="line.credit" inputmode="decimal" /></label><label>Note<input v-model="line.remarks" maxlength="500" /></label>
            <button type="button" :disabled="lines.length <= 2" :aria-label="`Remove posting line ${index + 1}`" @click="lines.splice(index, 1)">Remove</button>
          </div>
          <button type="button" class="journal-button" :disabled="lines.length >= 500" @click="lines.push({ accountId: '', debit: '', credit: '', remarks: '' })">Add line</button>
          <p>Debit {{ formatMoney(totals.debit) }} · Credit {{ formatMoney(totals.credit) }}</p>
        </template>
        <template v-else><p>The document and any linked journal will be voided together. Their history remains available. Related payments must be removed or voided first.</p><label>Reason<textarea v-model="reason" required minlength="3" maxlength="500" rows="3" /></label></template>
      </fieldset>
      <p v-if="mutation.error.value" class="journal-editor__error" role="alert">{{ mutation.error.value }}</p>
      <footer class="journal-editor__footer"><button type="button" class="journal-button" :disabled="mutation.pending.value" @click="dialog?.close()">Cancel</button><button type="submit" class="journal-button journal-button--primary" :disabled="mutation.pending.value || (mode === 'post' && !options.length)">{{ mutation.pending.value ? 'Saving…' : mode === 'post' ? 'Post document' : 'Void record' }}</button></footer>
    </form>
  </dialog>
</template>
