<script setup lang="ts">
// 由新到舊列出各屆卡片（目前選取區域的最深一層）
import { computed, inject } from 'vue';
import YearCard from './YearCard.vue';
import type { Level } from '../../data/types';
import { CompareKey } from '../../views/useCompare';

const props = defineProps<{ level: Level; county: string }>();
const ctx = inject(CompareKey)!;
const cards = computed(() => {
  void ctx.version.value;
  const s = ctx.state.value;
  return [...ctx.store.meta.years()].reverse().map((y) => ({
    year: y,
    preview: !ctx.store.meta.hasResults(y),
    row: ctx.rowAt(y, s),
    flipped: ctx.flipAt(y, s),
  }));
});
</script>

<template>
  <div class="cards">
    <YearCard
      v-for="c in cards" :key="c.year" :year="c.year" :row="c.row" :level="props.level"
      :county="props.county" :flipped="c.flipped" :preview="c.preview"
    />
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: var(--s-3); }
</style>
