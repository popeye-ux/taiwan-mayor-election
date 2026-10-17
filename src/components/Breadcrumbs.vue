<script setup lang="ts">
import type { ViewState } from '../state/url';

defineProps<{ items: { label: string; to: Partial<ViewState> | null }[] }>();
defineEmits<{ go: [to: Partial<ViewState>] }>();
</script>

<template>
  <nav class="crumbs" aria-label="層級">
    <template v-for="(it, i) in items" :key="i">
      <i v-if="i > 0">/</i>
      <button v-if="it.to" type="button" @click="$emit('go', it.to)">{{ it.label }}</button>
      <span v-else class="cur" aria-current="page">{{ it.label }}</span>
    </template>
  </nav>
</template>

<style scoped>
.crumbs { display: flex; align-items: center; gap: var(--s-2); font-size: var(--text-sm); color: var(--ink-2); min-width: 0; }
button, .cur { background: none; border: 0; padding: 6px 8px; border-radius: var(--r-full); color: var(--ink-2); white-space: nowrap; }
button { cursor: pointer; }
button:hover { background: var(--hover); color: var(--ink); }
.cur { color: var(--ink); }
i { font-style: normal; color: var(--ink-3); }
</style>
