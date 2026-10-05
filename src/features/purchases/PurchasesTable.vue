<script setup lang="ts">
import { computed } from 'vue'
import { formatMoney } from '../../lib/money'
import { purchaseConfigs, purchaseVendorName, type PurchaseKind, type PurchaseRecord } from './purchasePreviewData'

const props = defineProps<{ kind: PurchaseKind; records: PurchaseRecord[]; filtered: boolean }>()
const emit = defineEmits<{ open: [record: PurchaseRecord]; reset: []; add: [] }>()
const invoice = computed(() => props.kind === 'purchase-invoices')
const payroll = computed(() => props.kind === 'payrolls')
const receipt = computed(() => props.kind === 'purchase-receipts')
const total = computed(() => props.records.reduce((sum, record) => sum + record.totalCents, 0))
const amount = computed(() => props.records.reduce((sum, record) => sum + record.amountCents, 0))

function formatDate(value: string): string {
  const [year, month, day] = value.split('-')
  return year && month && day ? `${month}/${day}/${year}` : value
}
</script>

<template>
  <div class="purchases-results" :class="{ 'purchases-results--invoice': invoice, 'purchases-results--payroll': payroll, 'purchases-results--receipt': receipt }">
    <div class="purchases-results__scroll">
      <table class="purchases-table"><thead><tr>
        <th scope="col">{{ purchaseConfigs[kind].numberLabel }}</th>
        <template v-if="payroll"><th scope="col">Month</th><th scope="col">Year</th><th scope="col">Period</th><th scope="col">Payroll Frequency</th><th scope="col">Pay Group</th><th scope="col">Accrual JE</th></template>
        <template v-else-if="receipt"><th scope="col">Date</th><th scope="col">Vendor</th><th scope="col">Payment Method</th><th scope="col">Status</th><th scope="col" class="purchases-table__money">Amount</th></template>
        <template v-else-if="invoice"><th scope="col">Date</th><th scope="col">Vendor</th><th scope="col" class="purchases-table__money">Amount</th><th scope="col" class="purchases-table__money">Total Amount</th><th scope="col">Total Paid</th><th scope="col">Status</th><th scope="col">Fully Paid?</th><th scope="col">Remarks</th></template>
        <template v-else><th scope="col">Vendor</th><th scope="col">Date</th><th scope="col" class="purchases-table__money">Amount</th><th scope="col" class="purchases-table__money">Total Amount</th><th scope="col">Status</th><th scope="col">Remarks</th></template>
      </tr></thead><tbody><tr v-for="record in records" :key="record.id">
        <td><button type="button" class="purchases-table__link" :aria-label="`View ${record.number}`" @click="emit('open', record)">{{ record.number }}</button></td>
        <template v-if="payroll"><td>{{ record.month }}</td><td>{{ record.year }}</td><td>{{ record.period }}</td><td>{{ record.payrollFrequency }}</td><td>{{ record.payGroup }}</td><td>{{ record.accrualJE }}</td></template>
        <template v-else-if="receipt"><td>{{ formatDate(record.date) }}</td><td :title="purchaseVendorName(record.vendorId)">{{ purchaseVendorName(record.vendorId) }}</td><td>{{ record.paymentMethod }}</td><td><span :class="record.status === 'Posted' ? 'purchases-table__posted' : 'purchases-table__draft'">{{ record.status }}</span></td><td class="purchases-table__money">{{ formatMoney(record.totalCents) }}</td></template>
        <template v-else-if="invoice"><td>{{ formatDate(record.date) }}</td><td :title="purchaseVendorName(record.vendorId)">{{ purchaseVendorName(record.vendorId) }}</td><td class="purchases-table__money">{{ formatMoney(record.amountCents) }}</td><td class="purchases-table__money">{{ formatMoney(record.totalCents) }}</td><td><div class="purchases-table__paid"><span>{{ formatMoney(record.paidCents) }}</span><span>{{ record.totalCents ? (record.paidCents / record.totalCents * 100).toFixed(2) : '0.00' }}%</span></div><div class="purchases-table__progress"><span :style="{ width: `${record.totalCents ? record.paidCents / record.totalCents * 100 : 0}%` }" /></div></td><td><span :class="record.status === 'Posted' ? 'purchases-table__posted' : 'purchases-table__draft'">{{ record.status }}</span></td><td><input type="checkbox" :checked="record.paidCents >= record.totalCents" disabled :aria-label="`${record.number} fully paid ${record.paidCents >= record.totalCents ? 'yes' : 'no'}`" /></td><td :title="record.remarks">{{ record.remarks }}</td></template>
        <template v-else><td :title="purchaseVendorName(record.vendorId)">{{ purchaseVendorName(record.vendorId) }}</td><td>{{ formatDate(record.date) }}</td><td class="purchases-table__money">{{ formatMoney(record.amountCents) }}</td><td class="purchases-table__money">{{ formatMoney(record.totalCents) }}</td><td><span :class="record.status === 'Posted' ? 'purchases-table__posted' : 'purchases-table__draft'">{{ record.status }}</span></td><td :title="record.remarks">{{ record.remarks }}</td></template>
      </tr></tbody></table>
      <div v-if="!records.length" class="purchases-empty" role="status"><strong>{{ filtered ? 'No matching records' : 'No rows to show' }}</strong><p>{{ filtered ? 'Try another search, tab, or date range.' : 'No records are connected for this view.' }}</p><button v-if="filtered" class="purchases-button" type="button" @click="emit('reset')">Reset filters</button><button v-else class="purchases-button" type="button" @click="emit('add')">Add draft</button></div>
    </div>
    <footer class="purchases-results__footer"><span><span class="purchases-sr-only">Entries: </span>{{ records.length }}</span><span v-if="!payroll"><span class="purchases-sr-only">Amount: </span>{{ formatMoney(amount) }}</span><span v-if="invoice || !receipt"><span class="purchases-sr-only">Total amount: </span>{{ formatMoney(total) }}</span></footer>
  </div>
</template>
