<script setup lang="ts">
import Chip from './Chip.vue';

export type Summary =
  | { kind: 'seats'; items: { color: string; label: string; seats: number }[]; total: number }
  | { kind: 'text'; title: string; line: string }
  | { kind: 'winner'; color: string; name: string; flipped: boolean | null; line: string }
  | { kind: 'none' }
  | { kind: 'pending'; line: string };

defineProps<{ summary: Summary }>();
</script>

<template>
  <div class="sum">
    <template v-if="summary.kind === 'seats'">
      <div class="bar">
        <i v-for="it in summary.items" :key="it.label" :style="{ background: it.color, flex: it.seats }" />
      </div>
      <div class="counts">
        <span v-for="it in summary.items" :key="it.label"><i class="dot" :style="{ background: it.color }" />{{ it.label }} {{ it.seats }}</span>
      </div>
    </template>
    <div v-else-if="summary.kind === 'winner'" class="cw">
      <b><i class="dot" :style="{ background: summary.color }" />{{ summary.name }}<Chip v-if="summary.flipped" tone="flip">政黨輪替</Chip></b>
      <small>{{ summary.line }}</small>
    </div>
    <div v-else-if="summary.kind === 'text'" class="cw">
      <b>{{ summary.title }}</b>
      <small>{{ summary.line }}</small>
    </div>
    <div v-else-if="summary.kind === 'pending'" class="cw"><small>{{ summary.line }}</small></div>
    <div v-else class="cw"><small>本屆無資料</small></div>
  </div>
</template>

<style scoped>
.sum { display: flex; flex-direction: column; gap: 6px; font-size: var(--text-xs); color: var(--ink-2); }
.bar { display: flex; height: 6px; border-radius: var(--r-full); overflow: hidden; gap: 1px; background: var(--surface); }
.bar i { display: block; height: 100%; }
.counts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 6px; font-family: var(--font-mono); font-size: var(--text-2xs); }
.counts span { display: flex; align-items: center; gap: 5px; color: var(--ink); white-space: nowrap; }
.cw { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.cw b { font-size: var(--text-md); font-weight: 500; color: var(--ink); display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; }
.cw small { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); white-space: nowrap; }
</style>
