<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { Minus, Plus, Search, X } from '@lucide/vue'

/** One-column list with add (+) and remove-selected (−), like the legacy Registration lists. */
const props = defineProps<{ title: string; columnLabel: string; suggestions: string[] }>()
const items = defineModel<string[]>({ required: true })

const uid = useId()
const search = ref('')
const selected = ref<string[]>([])
const dialog = ref<HTMLDialogElement | null>(null)
const input = ref<HTMLInputElement | null>(null)
const newValue = ref('')
const error = ref('')
const visible = computed(() => {
  const term = search.value.trim().toLocaleLowerCase()
  return items.value.filter((item) => !term || item.toLocaleLowerCase().includes(term))
})
const available = computed(() => props.suggestions.filter((item) => !items.value.some((existing) => existing.toLocaleLowerCase() === item.toLocaleLowerCase())))

function toggle(item: string) {
  selected.value = selected.value.includes(item) ? selected.value.filter((value) => value !== item) : [...selected.value, item]
}

function openAdd() {
  newValue.value = ''
  error.value = ''
  dialog.value?.showModal()
  nextTick(() => input.value?.focus())
}

function add() {
  const value = newValue.value.trim()
  if (!value) { error.value = `Enter a ${props.columnLabel.toLocaleLowerCase()}.`; return }
  if (items.value.some((item) => item.toLocaleLowerCase() === value.toLocaleLowerCase())) { error.value = `${value} is already listed.`; return }
  items.value = [...items.value, value]
  dialog.value?.close()
}

function removeSelected() {
  items.value = items.value.filter((item) => !selected.value.includes(item))
  selected.value = []
}
</script>

<template>
  <div class="ws-panel ws-panel--clip">
    <div class="ws-panel__header">
      <h2>{{ title }}</h2>
      <div class="ws-panel__actions">
        <label class="ws-search"><Search :size="16" aria-hidden="true" /><input v-model="search" type="search" placeholder="Type to filter" :aria-label="`Search ${title}`" /></label>
        <button class="co-round-button" type="button" :aria-label="`Remove selected ${title.toLocaleLowerCase()}`" title="Remove selected" :disabled="!selected.length" @click="removeSelected"><Minus :size="17" aria-hidden="true" /></button>
        <button class="co-round-button" type="button" :aria-label="`Add ${columnLabel.toLocaleLowerCase()}`" title="Add" @click="openAdd"><Plus :size="17" aria-hidden="true" /></button>
      </div>
    </div>
    <table class="ws-table co-list co-type-list">
      <thead><tr><th scope="col" class="co-type-list__select"><span class="ws-visually-hidden">Select</span></th><th scope="col">{{ columnLabel }}</th></tr></thead>
      <tbody>
        <tr v-for="item in visible" :key="item" class="co-list__row" :class="{ 'co-type-list__row--selected': selected.includes(item) }" @click="toggle(item)">
          <td class="co-type-list__select"><input type="checkbox" :checked="selected.includes(item)" :aria-label="`Select ${item}`" @click.stop @change="toggle(item)" /></td>
          <td>{{ item }}</td>
        </tr>
        <tr v-if="!visible.length" class="co-list__empty"><td colspan="2"><strong>No rows to show</strong><span>{{ items.length ? 'Try another search.' : 'Use + to add one.' }}</span></td></tr>
      </tbody>
      <tfoot><tr><td colspan="2">{{ visible.length }}</td></tr></tfoot>
    </table>

    <dialog ref="dialog" class="ws-dialog ws-dialog--small" :aria-labelledby="`${uid}-title`">
      <form novalidate @submit.prevent="add">
        <div class="ws-dialog__header"><h2 :id="`${uid}-title`">Add {{ columnLabel.toLocaleLowerCase() }}</h2><button class="ws-icon-button" type="button" aria-label="Close" @click="dialog?.close()"><X :size="18" aria-hidden="true" /></button></div>
        <div class="ws-dialog__body">
          <label class="ws-field"><span>{{ columnLabel }}<em> *</em></span><input ref="input" v-model="newValue" :list="`${uid}-suggestions`" maxlength="120" /></label>
          <datalist :id="`${uid}-suggestions`"><option v-for="item in available" :key="item" :value="item" /></datalist>
          <p v-if="error" class="ws-form-error" role="alert">{{ error }}</p>
        </div>
        <div class="ws-dialog__footer"><button class="ws-button" type="button" @click="dialog?.close()">Cancel</button><button class="ws-button ws-button--primary" type="submit">Add</button></div>
      </form>
    </dialog>
  </div>
</template>
