<script setup lang="ts">
defineProps<{ text: string | null; retry?: boolean }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="text" class="status" role="status">
    <button v-if="retry" type="button" @click="$emit('retry')">{{ text }}</button>
    <span v-else>{{ text }}</span>
  </div>
</template>

<style scoped>
.status {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: 72px; z-index: 6;
  padding: 6px 12px; background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  border-radius: var(--r-full); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2);
  letter-spacing: var(--ls-label); white-space: nowrap;
}
button { border: 0; background: none; padding: 0; cursor: pointer; color: var(--accent); font: inherit; }
</style>
