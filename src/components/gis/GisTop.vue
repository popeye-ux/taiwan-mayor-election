<script setup lang="ts">
// GIS 左上兩層 capsule：品牌＋麵包屑；[四屆比較｜GIS]、年份、圖層
import SegmentedControl from '../SegmentedControl.vue';
import type { Layer } from '../../data/types';

defineProps<{ years: number[]; year: number; layer: Layer }>();
const emit = defineEmits<{ year: [year: number]; layer: [layer: Layer]; view: [view: 'compare'] }>();

const views = [
  { value: 'compare', label: '四屆比較' },
  { value: 'gis', label: '地理資訊圖台' },
];
const layers = [
  { value: 'party', label: '當選政黨' },
  { value: 'margin', label: '得票差距' },
  { value: 'turnout', label: '投票率' },
  { value: 'flip', label: '政黨輪替' },
  { value: 'bellwether', label: '章魚區' },
];
</script>

<template>
  <div class="caps">
    <div class="cap">
      <div class="brand"><b>九合一選舉圖台</b><span>Mayoral · 2014–2026</span></div>
      <slot />
    </div>
    <div class="cap">
      <SegmentedControl :options="views" model-value="gis" @update:model-value="(v) => v === 'compare' && emit('view', 'compare')" />
      <SegmentedControl
        mono :options="years.map((y) => ({ value: String(y), label: String(y) }))" :model-value="String(year)"
        @update:model-value="(v) => emit('year', Number(v))"
      />
      <SegmentedControl :options="layers" :model-value="layer" @update:model-value="(v) => emit('layer', v as Layer)" />
    </div>
  </div>
</template>

<style scoped>
.caps { position: fixed; top: 16px; left: 16px; z-index: 10; display: flex; flex-direction: column; align-items: flex-start; gap: 8px; max-width: calc(100vw - 504px); }
.cap {
  display: flex; align-items: center; flex-wrap: wrap; gap: var(--s-3); padding: 6px 10px; max-width: 100%;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  /* 固定圓角（不用 r-full）：窄螢幕換行成多列時不會變成橢圓 */
  border-radius: 24px;
  box-shadow: var(--shadow-menu);
}
.brand { display: flex; flex-direction: column; line-height: 1.15; padding: 0 var(--s-2); flex: none; }
.brand b { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md, 15px); letter-spacing: -.01em; }
.brand span {
  font-family: var(--font-mono); font-size: var(--text-2xs); letter-spacing: var(--ls-label);
  color: var(--ink-2); text-transform: uppercase; white-space: nowrap;
}
</style>
