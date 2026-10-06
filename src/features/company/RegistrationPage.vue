<script setup lang="ts">
import { computed, ref } from 'vue'
import { BookOpen, FileText, List, Minus, Plus, ReceiptText } from '@lucide/vue'
import AppDatePicker from '../../components/ui/AppDatePicker.vue'
import AppSelect from '../../components/ui/AppSelect.vue'
import { registrationSettings, type RegistrationSettings } from './companyStore'
import { toOptions } from './recordConfig'
import SaveBar from './SaveBar.vue'
import SubNavLayout from './SubNavLayout.vue'
import TypeListCard from './TypeListCard.vue'
import { useSettingsDraft } from './useSettingsDraft'
import '../workspace/workspace.css'
import './company.css'

type Section = 'tax-types' | 'books' | 'invoices' | 'receipts'
const sections: { id: Section; label: string; icon: typeof List }[] = [
  { id: 'tax-types', label: 'Registered Tax Types', icon: List },
  { id: 'books', label: 'Registered Books', icon: BookOpen },
  { id: 'invoices', label: 'Registered Invoices', icon: FileText },
  { id: 'receipts', label: 'Registered Receipts', icon: ReceiptText },
]
const section = ref<Section>('tax-types')

// Suggestions only; any name can be entered.
const taxTypeSuggestions = ['Income Tax', 'Value-Added Tax', 'Percentage Tax', 'Withholding Tax - Compensation', 'Withholding Tax - Expanded', 'Withholding Tax - Final']
const invoiceSuggestions = ['Sales Invoice']
const receiptSuggestions = ['Official Receipt', 'Collection Receipt', 'Acknowledgement Receipt']
const journalTypes = toOptions(['General Ledger', 'General Journal', 'Sales Journal', 'Purchase Journal', 'Cash Receipt Journal', 'Cash Disbursement Journal'])
const formats = toOptions(['Default'])
const bookTypes = toOptions(['Manual', 'Loose-leaf', 'Computerized'])

function validate(draft: RegistrationSettings): string {
  if (!draft.bookType) return 'Choose the book type in Registered Books.'
  if (draft.books.some((book) => !book.journalType)) return 'Choose a journal type for every registered book.'
  const types = draft.books.map((book) => book.journalType)
  if (new Set(types).size !== types.length) return 'Each journal type can be listed only once in Registered Books.'
  return ''
}

const { draft, error, notice, dirty, saving, save, discard } = useSettingsDraft(registrationSettings, 'Registration', validate)
const selectedBooks = ref<string[]>([])
const allBooksSelected = computed(() => draft.value.books.length > 0 && draft.value.books.every((book) => selectedBooks.value.includes(book.id)))

function addBook() {
  const used = new Set(draft.value.books.map((book) => book.journalType))
  const next = journalTypes.find((option) => !used.has(option.value))?.value ?? ''
  draft.value.books.push({ id: crypto.randomUUID(), journalType: next, format: 'Default' })
}

function removeBooks() {
  draft.value.books = draft.value.books.filter((book) => !selectedBooks.value.includes(book.id))
  selectedBooks.value = []
}

function toggleBook(id: string) {
  selectedBooks.value = selectedBooks.value.includes(id) ? selectedBooks.value.filter((value) => value !== id) : [...selectedBooks.value, id]
}
</script>

<template>
  <section class="ws-page co-page" aria-label="Registration">
    <div class="ws-stack">
      <p v-if="notice && !dirty" class="ws-notice" role="status">{{ notice }}</p>
      <SubNavLayout v-model="section" :items="sections" label="Registration sections">
        <TypeListCard v-if="section === 'tax-types'" v-model="draft.taxTypes" title="Tax Types" column-label="Tax Type" :suggestions="taxTypeSuggestions" />
        <TypeListCard v-else-if="section === 'invoices'" v-model="draft.invoiceTypes" title="Registered Invoices" column-label="Invoice Type" :suggestions="invoiceSuggestions" />
        <TypeListCard v-else-if="section === 'receipts'" v-model="draft.receiptTypes" title="Registered Receipts" column-label="Receipt Type" :suggestions="receiptSuggestions" />
        <div v-else class="ws-stack">
          <div class="ws-panel co-card">
            <div class="ws-form">
              <div class="ws-field"><AppSelect id="registration-book-type" v-model="draft.bookType" label="Book Type" required :options="bookTypes" /></div>
              <span />
              <label class="ws-field"><span>Permit #</span><input v-model="draft.permitNumber" maxlength="60" /></label>
              <div class="ws-field"><AppDatePicker id="registration-permit-date" v-model="draft.permitDate" label="Permit Date" /></div>
            </div>
          </div>
          <div class="ws-panel ws-panel--clip">
            <div class="ws-panel__header">
              <h2>Books</h2>
              <div class="ws-panel__actions">
                <button class="co-round-button" type="button" aria-label="Add book" title="Add book" :disabled="draft.books.length >= journalTypes.length" @click="addBook"><Plus :size="17" aria-hidden="true" /></button>
                <button class="co-round-button" type="button" aria-label="Remove selected books" title="Remove selected" :disabled="!selectedBooks.length" @click="removeBooks"><Minus :size="17" aria-hidden="true" /></button>
              </div>
            </div>
            <table class="ws-table co-list co-books">
              <thead><tr>
                <th scope="col" class="co-type-list__select"><input type="checkbox" :checked="allBooksSelected" :disabled="!draft.books.length" aria-label="Select all books" @change="selectedBooks = allBooksSelected ? [] : draft.books.map((book) => book.id)" /></th>
                <th scope="col">Journal Type</th><th scope="col">Journal Type Format</th>
              </tr></thead>
              <tbody>
                <tr v-for="(book, index) in draft.books" :key="book.id" :class="{ 'co-type-list__row--selected': selectedBooks.includes(book.id) }">
                  <td class="co-type-list__select"><input type="checkbox" :checked="selectedBooks.includes(book.id)" :aria-label="`Select book ${index + 1}`" @change="toggleBook(book.id)" /></td>
                  <td><AppSelect :id="`book-type-${book.id}`" v-model="book.journalType" :aria-label="`Book ${index + 1} journal type`" placeholder="Select journal" :options="journalTypes.map((option) => ({ ...option, disabled: option.value !== book.journalType && draft.books.some((other) => other.journalType === option.value) }))" /></td>
                  <td><AppSelect :id="`book-format-${book.id}`" v-model="book.format" :aria-label="`Book ${index + 1} format`" :options="formats" /></td>
                </tr>
                <tr v-if="!draft.books.length" class="co-list__empty"><td colspan="3"><strong>No rows to show</strong><span>Use + to add each registered book.</span></td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </SubNavLayout>
      <SaveBar :dirty="dirty" :error="error" :busy="saving" @save="save" @discard="discard" />
    </div>
  </section>
</template>
