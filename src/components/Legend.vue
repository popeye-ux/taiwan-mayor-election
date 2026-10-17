<script setup lang="ts">
import { computed } from 'vue';
import type { Layer, Party } from '../data/types';
import { FLIP_NO, FLIP_YES, NONE, TURNOUT_HIGH, TURNOUT_LOW } from '../domain/fill';
import { BW_DEEP, BW_PALE, BW_RAMP_MAX } from '../domain/bellwether';

/** national：全國視圖（章魚區在縣市層不適用） */
const props = defineProps<{ layer: Layer; parties: Party[]; national: boolean }>();
const bwRamp = `linear-gradient(90deg, ${BW_DEEP}, ${BW_PALE})`;
const marginRamp = computed(() => `linear-gradient(90deg, ${NONE}, ${props.parties[0]?.color ?? '#3B6FFF'})`);
const turnoutRamp = `linear-gradient(90deg, ${TURNOUT_LOW}, ${TURNOUT_HIGH})`;
</script>

<template>
  <div class="legend">
    <template v-if="layer === 'party'">
      <span v-for="p in parties" :key="p.id" class="lg"><i class="dot" :style="{ background: p.color }" />{{ p.label }}</span>
      <span class="lg"><i class="dot light" :style="{ background: NONE }" />未開票</span>
    </template>
    <template v-else-if="layer === 'margin'">
      <span class="lg mono">0 pp</span><i class="ramp" :style="{ background: marginRamp }" /><span class="lg mono">≥ 33 pp</span>
      <span class="lg">色相 = 當選政黨</span>
    </template>
    <template v-else-if="layer === 'turnout'">
      <span class="lg mono">40%</span><i class="ramp" :style="{ background: turnoutRamp }" /><span class="lg mono">75%</span>
    </template>
    <template v-else-if="layer === 'bellwether'">
      <span v-if="national" class="lg">章魚區 · 放大到縣市以下查看</span>
      <template v-else>
        <span class="lg mono">0 pp</span><i class="ramp" :style="{ background: bwRamp }" /><span class="lg mono">≥ {{ BW_RAMP_MAX }} pp</span>
        <span class="lg"><i class="dot light" :style="{ background: NONE }" />第一名與全縣市不同／有效票不足</span>
      </template>
    </template>
    <template v-else>
      <span class="lg"><i class="dot" :style="{ background: FLIP_YES }" />政黨輪替</span>
      <span class="lg"><i class="dot light" :style="{ background: FLIP_NO }" />延續執政</span>
      <span class="lg"><i class="dot light" :style="{ background: NONE }" />無前屆比較</span>
    </template>
  </div>
</template>

<style scoped>
.legend {
  position: absolute; left: 50%; transform: translateX(-50%); bottom: var(--s-4); z-index: 5;
  display: flex; flex-wrap: wrap; align-items: center; gap: var(--s-4); max-width: calc(100% - 96px);
  padding: 10px 14px; background: var(--bg-overlay); backdrop-filter: blur(20px);
  border: 1px solid var(--hairline); border-radius: var(--r-md); font-size: var(--text-xs); color: var(--ink-2);
}
.lg { display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.dot.light { box-shadow: 0 0 0 1px #C3C7D6; }
.ramp { width: 120px; height: 6px; border-radius: var(--r-full); display: block; }
</style>
