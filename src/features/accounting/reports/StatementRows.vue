<script setup lang="ts">
import type { StatementSection } from './ledgerMath'
import { amount } from './reportFormat'

defineProps<{ label: string; section: StatementSection; detailed: boolean; emptyText: string }>()
</script>

<template>
  <tr class="acct-statement__section"><th scope="rowgroup" colspan="2">{{ label }}</th></tr>
  <template v-for="group in section.groups" :key="group.category">
    <template v-if="detailed">
      <tr class="acct-statement__group"><td colspan="2">{{ group.category }}</td></tr>
      <tr v-for="row in group.accounts" :key="row.account.id" class="acct-statement__account">
        <td>{{ row.account.name }}<small>{{ row.account.code }}</small></td>
        <td class="ws-num">{{ amount(row.amountCents) }}</td>
      </tr>
      <tr class="acct-statement__subtotal"><td>Total {{ group.category }}</td><td class="ws-num">{{ amount(group.totalCents) }}</td></tr>
    </template>
    <tr v-else class="acct-statement__group"><td>{{ group.category }}</td><td class="ws-num">{{ amount(group.totalCents) }}</td></tr>
  </template>
  <tr v-if="!section.groups.length" class="acct-statement__account"><td class="ws-muted" colspan="2">{{ emptyText }}</td></tr>
  <tr class="acct-statement__total"><td>Total {{ label.toLocaleLowerCase() }}</td><td class="ws-num">{{ amount(section.totalCents) }}</td></tr>
</template>
