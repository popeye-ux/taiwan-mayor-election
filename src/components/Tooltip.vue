<script setup lang="ts">
defineProps<{ x: number; y: number; lines: string[] | null }>();
</script>

<template>
  <div v-if="lines && lines.length" class="tip" :style="{ left: `${x + 14}px`, top: `${y + 14}px` }">
    <div class="t1">{{ lines[0] }}</div>
    <div v-for="(l, i) in lines.slice(1)" :key="i" class="t2">{{ l }}</div>
  </div>
</template>

<style scoped>
.tip {
  position: fixed; z-index: 50; pointer-events: none; padding: 10px 12px; min-width: 160px;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  border-radius: var(--r-md); box-shadow: var(--shadow-menu); font-size: var(--text-sm);
}
.t1 { font-weight: 500; }
.t2 { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); margin-top: 2px; }
</style>
