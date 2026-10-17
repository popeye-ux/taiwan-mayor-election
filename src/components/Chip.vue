<script setup lang="ts">
defineProps<{ color?: string; active?: boolean; tone?: 'flip' | 'win' }>();
</script>

<template>
  <span class="chip" :class="[{ active }, tone]"><i v-if="color" class="dot" :style="{ background: color }" /><slot /></span>
</template>

<style scoped>
.chip {
  display: inline-flex; align-items: center; gap: 5px; padding: 2px 7px; border-radius: var(--r-full);
  border: 1px solid var(--hairline); background: var(--surface); font-size: var(--text-2xs); color: var(--ink);
  letter-spacing: .02em; white-space: nowrap; font-weight: 400;
}
.chip.flip { color: var(--flip); border-color: rgba(255, 77, 141, .4); }
.chip.win { color: var(--accent); }
.chip.active { border-color: var(--selected); }
</style>
