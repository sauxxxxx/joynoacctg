<script setup lang="ts">
defineProps<{ dirty: boolean; error?: string; busy?: boolean }>()
const emit = defineEmits<{ save: []; discard: [] }>()
</script>

<template>
  <div class="co-savebar">
    <p v-if="error" class="co-savebar__error" role="alert">{{ error }}</p>
    <span v-else class="co-savebar__status">{{ busy ? 'Saving your changes…' : dirty ? 'You have unsaved changes.' : 'All changes saved.' }}</span>
    <button class="ws-button" type="button" :disabled="!dirty || busy" @click="emit('discard')">Discard</button>
    <button class="ws-button ws-button--primary" type="button" :disabled="!dirty || busy" @click="emit('save')">{{ busy ? 'Saving…' : 'Save changes' }}</button>
  </div>
</template>
