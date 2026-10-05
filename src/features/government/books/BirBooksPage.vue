<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, BookOpen, Download, Filter, RefreshCw, Search } from '@lucide/vue'
import AppDatePicker from '../../../components/ui/AppDatePicker.vue'
import AppSelect from '../../../components/ui/AppSelect.vue'
import { useAsyncResource } from '../../../lib/asyncState'
import { downloadCsv } from '../../../lib/csv'
import { formatMoney } from '../../../lib/money'
import { journalSourceLabels } from '../../accounting/reports/ledgerContract'
import type { BirBooksQuery, BirBookSort } from './birBooksContract'
import { previewBirBooksService } from './previewBirBooksService'
import './bir-books.css'

const pad = (value: number) => String(value).padStart(2, '0')
const now = new Date()
const firstDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
const lastDay = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate())}`
const query = ref<BirBooksQuery>({ page: 1, pageSize: 20, search: '', filters: { from: firstDay, to: lastDay, source: '' }, sortBy: 'date', sortDirection: 'desc' })
const cloneQuery = (value: BirBooksQuery): BirBooksQuery => ({ ...value, filters: { ...value.filters } })
const applied = ref<BirBooksQuery>(cloneQuery(query.value))
const filterOpen = ref(false)
const sourceOptions = [{ value: '', label: 'All books' }, ...Object.entries(journalSourceLabels).map(([value, label]) => ({ value, label }))]
const resource = useAsyncResource({ load: () => previewBirBooksService.list(applied.value), isEmpty: (value) => value.totalItems === 0 })
const page = computed(() => resource.data.value)
const rows = computed(() => page.value?.items ?? [])
const totalDebit = computed(() => rows.value.reduce((sum, row) => sum + row.debitCents, 0))
const totalCredit = computed(() => rows.value.reduce((sum, row) => sum + row.creditCents, 0))

function applyFilters() {
  applied.value = cloneQuery({ ...query.value, page: 1 })
  filterOpen.value = false
  void resource.run()
}

function sortBy(key: BirBookSort) {
  applied.value = { ...applied.value, page: 1, sortBy: key, sortDirection: applied.value.sortBy === key && applied.value.sortDirection === 'asc' ? 'desc' : 'asc' }
  void resource.run()
}

function changePage(next: number) {
  applied.value = { ...applied.value, page: next }
  void resource.run()
}

function sortIcon(key: BirBookSort) {
  return applied.value.sortBy === key ? (applied.value.sortDirection === 'asc' ? ArrowUp : ArrowDown) : null
}

function exportRows() {
  const header = ['Book type', 'Entry #', 'Reference', 'Date', 'Source journal', 'Description', 'Debit', 'Credit']
  const values = rows.value.map((row) => [row.bookType, row.entryNumber, row.reference, row.date, row.sourceLabel, row.description, formatMoney(row.debitCents), formatMoney(row.creditCents)])
  downloadCsv(`bir-books-${applied.value.filters.from || 'all'}-${applied.value.filters.to || 'all'}.csv`, [header, ...values])
}

let searchTimer: number | undefined
watch(() => query.value.search, () => {
  if (searchTimer) window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => { applied.value = { ...applied.value, page: 1, search: query.value.search }; void resource.run() }, 250)
})
onMounted(resource.run)
</script>

<template>
  <section class="bir-books ws-page" aria-label="BIR books">
    <div class="ws-stack">
      <p class="ws-note"><BookOpen :size="15" aria-hidden="true" />Read-only posted accounting records. Preview entries come from the sample ledger service.</p>
      <div class="ws-panel ws-panel--clip">
        <div class="ws-toolbar">
          <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="query.search" type="search" placeholder="Search entries" aria-label="Search BIR books" /></label>
          <div class="bir-books__filter">
            <button class="ws-button" type="button" :aria-expanded="filterOpen" aria-controls="bir-books-filter" @click="filterOpen = !filterOpen"><Filter :size="15" /> Filters</button>
            <form v-if="filterOpen" id="bir-books-filter" class="bir-books__filter-panel" @submit.prevent="applyFilters">
              <AppDatePicker v-model="query.filters.from" label="From" />
              <AppDatePicker v-model="query.filters.to" label="To" />
              <AppSelect v-model="query.filters.source" label="Book" :options="sourceOptions" />
              <button class="ws-button ws-button--primary" type="submit">Apply filters</button>
            </form>
          </div>
          <span class="ws-toolbar__spacer" />
          <button class="ws-button" type="button" :disabled="!rows.length" @click="exportRows"><Download :size="15" /> Export current page</button>
        </div>

        <div v-if="resource.loading.value" class="ws-loading" role="status"><span class="ws-spinner" aria-hidden="true" />Loading BIR books…</div>
        <div v-else-if="resource.status.value === 'error'" class="ws-empty" role="alert"><strong>Entries could not be loaded</strong><span>{{ resource.error.value }}</span><button class="ws-button" type="button" @click="resource.run"><RefreshCw :size="15" /> Try again</button></div>
        <div v-else-if="resource.status.value === 'empty'" class="ws-empty" role="status"><BookOpen class="ws-empty__icon" :size="22" /><strong>No posted entries found</strong><span>Adjust the search, dates, or selected book.</span></div>
        <div v-else class="ws-table-wrap">
          <table class="ws-table bir-books__table">
            <thead><tr>
              <th scope="col"><button type="button" @click="sortBy('source')">Book type <component :is="sortIcon('source')" v-if="sortIcon('source')" :size="12" /></button></th>
              <th scope="col"><button type="button" @click="sortBy('entryNumber')">Entry # <component :is="sortIcon('entryNumber')" v-if="sortIcon('entryNumber')" :size="12" /></button></th>
              <th scope="col">Reference</th>
              <th scope="col"><button type="button" @click="sortBy('date')">Date <component :is="sortIcon('date')" v-if="sortIcon('date')" :size="12" /></button></th>
              <th scope="col">Description</th>
              <th scope="col" class="ws-num"><button type="button" @click="sortBy('debitCents')">Debit <component :is="sortIcon('debitCents')" v-if="sortIcon('debitCents')" :size="12" /></button></th>
              <th scope="col" class="ws-num"><button type="button" @click="sortBy('creditCents')">Credit <component :is="sortIcon('creditCents')" v-if="sortIcon('creditCents')" :size="12" /></button></th>
            </tr></thead>
            <tbody><tr v-for="entry in rows" :key="entry.id"><td>{{ entry.bookType }}</td><td>{{ entry.entryNumber }}</td><td>{{ entry.reference }}</td><td>{{ entry.date }}</td><td>{{ entry.description }}</td><td class="ws-num">{{ formatMoney(entry.debitCents) }}</td><td class="ws-num">{{ formatMoney(entry.creditCents) }}</td></tr></tbody>
            <tfoot><tr><th scope="row" colspan="5">Current page total</th><td class="ws-num">{{ formatMoney(totalDebit) }}</td><td class="ws-num">{{ formatMoney(totalCredit) }}</td></tr></tfoot>
          </table>
        </div>
        <footer v-if="page" class="ws-panel__footer"><span>{{ page.totalItems }} posted entries</span><div class="bir-books__pagination"><button class="ws-button ws-button--small" type="button" :disabled="page.page <= 1" @click="changePage(page.page - 1)">Previous</button><span>Page {{ page.page }} of {{ page.totalPages }}</span><button class="ws-button ws-button--small" type="button" :disabled="page.page >= page.totalPages" @click="changePage(page.page + 1)">Next</button></div></footer>
      </div>
    </div>
  </section>
</template>
