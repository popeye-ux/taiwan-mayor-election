<script setup lang="ts">
// 由新到舊列出各屆卡片（目前選取區域的最深一層）
import { computed, inject } from 'vue';
import YearCard from './YearCard.vue';
import type { Level } from '../../data/types';
import { ViewKey } from '../../views/common';

const props = defineProps<{ level: Level; county: string }>();
const ctx = inject(ViewKey)!;
const pending = computed(() => {
  void ctx.version.value;
  if (!ctx.state.value.village || ctx.store.hasVillages()) return null;
  return ctx.load.value.kind === 'error' ? '連線中斷 · 村里圖資' : '正在接收村里圖資…';
});
/** 選取的村里在這一屆的形狀是否借用其他屆圖資 */
function borrowedAt(year: number): boolean {
  const { village, town } = ctx.state.value;
  if (!village || !town || !ctx.store.hasVillages()) return false;
  const codes = new Set(ctx.store.villageCodesIn(year, village, town));
  return ctx.store.villagesOfTown(year, town).features.some((f) => codes.has(f.properties.VILLCODE) && !!f.properties.BORROWED);
}

const cards = computed(() => {
  void ctx.version.value;
  const s = ctx.state.value;
  return [...ctx.store.meta.years()].reverse().map((y) => ({
    year: y,
    preview: !ctx.store.meta.hasResults(y),
    row: ctx.rowAt(y, s),
    flipped: ctx.flipAt(y, s),
    current: ctx.currentYear.value === y,
    borrowed: borrowedAt(y),
  }));
});
</script>

<template>
  <div class="cards">
    <YearCard
      v-for="c in cards" :key="c.year" :year="c.year" :row="c.row" :level="props.level"
      :county="props.county" :flipped="c.flipped" :preview="c.preview" :pending="pending"
      :current="c.current" :borrowed="c.borrowed"
    />
  </div>
</template>

<style scoped>
.cards { display: flex; flex-direction: column; gap: var(--s-3); }
</style>
