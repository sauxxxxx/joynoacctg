<script setup lang="ts">
import AppDataState from './AppDataState.vue'
defineProps<{ error?: Error }>()
const reload = () => window.location.reload()
</script>

<template><AppDataState :loading="false" error="The page could not be opened. Check your connection and try again." label="Page" @retry="reload" /></template>
