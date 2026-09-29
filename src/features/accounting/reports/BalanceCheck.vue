<script setup lang="ts">
import { CheckCircle2, XCircle } from '@lucide/vue'
import { amount } from './reportFormat'

defineProps<{
  balanced: boolean
  okText: string
  failText: string
  figures: { label: string; cents: number; hideWhenBalanced?: boolean }[]
}>()
</script>

<template>
  <div class="ws-alert acct-report__summary acct-check" :class="balanced ? 'ws-alert--success' : 'ws-alert--danger'" role="status">
    <span class="acct-check__status">
      <CheckCircle2 v-if="balanced" :size="16" aria-hidden="true" /><XCircle v-else :size="16" aria-hidden="true" />
      <strong>{{ balanced ? okText : failText }}</strong>
    </span>
    <span class="acct-check__figures">
      <template v-for="figure in figures" :key="figure.label">
        <span v-if="!(balanced && figure.hideWhenBalanced)">{{ figure.label }} <b>{{ amount(figure.cents) }}</b></span>
      </template>
    </span>
  </div>
</template>
