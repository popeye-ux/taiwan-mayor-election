<script setup lang="ts">
defineProps<{ items: { label: string; value: string; sub?: string }[] }>();
</script>

<template>
  <div class="kv">
    <div v-for="(it, i) in items" :key="i">
      <span>{{ it.label }}</span>
      <b>{{ it.value }}</b>
      <span v-if="it.sub">{{ it.sub }}</span>
    </div>
  </div>
</template>

<style scoped>
.kv {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1px; background: var(--hairline);
  border: 1px solid var(--hairline); border-radius: var(--r-md); overflow: hidden;
}
.kv div { background: var(--surface); padding: 12px; white-space: nowrap; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
b { font-family: var(--font-mono); font-weight: 500; font-size: var(--text-lg); }
span { font-size: var(--text-xs); color: var(--ink-2); }
</style>
