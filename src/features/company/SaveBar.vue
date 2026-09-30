<script setup lang="ts">
defineProps<{ dirty: boolean; error?: string }>()
const emit = defineEmits<{ save: []; discard: [] }>()
</script>

<template>
  <div class="co-savebar">
    <p v-if="error" class="co-savebar__error" role="alert">{{ error }}</p>
    <span v-else class="co-savebar__status">{{ dirty ? 'You have unsaved changes.' : 'All changes saved.' }}</span>
    <button class="ws-button" type="button" :disabled="!dirty" @click="emit('discard')">Discard</button>
    <button class="ws-button ws-button--primary" type="button" :disabled="!dirty" @click="emit('save')">Save changes</button>
  </div>
</template>
