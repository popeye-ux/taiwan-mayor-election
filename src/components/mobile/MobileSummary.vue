<script setup lang="ts">
// 手機版四屆比較：目前屆次的摘要列，左右滑動換到前／後一屆（到頭不循環）
import PaneSummary, { type Summary } from '../PaneSummary.vue';
import { stepYear, swipeStep } from '../../domain/mobile';

const props = defineProps<{ summary: Summary; years: number[]; year: number }>();
const emit = defineEmits<{ year: [year: number] }>();

let startX: number | null = null;
function down(e: PointerEvent) {
  startX = e.clientX;
}
function up(e: PointerEvent) {
  if (startX === null) return;
  const next = stepYear(props.years, props.year, swipeStep(e.clientX - startX));
  startX = null;
  if (next !== props.year) emit('year', next);
}
</script>

<template>
  <div class="msum" @pointerdown="down" @pointerup="up" @pointercancel="startX = null">
    <PaneSummary :summary="summary" />
    <div class="dots" aria-hidden="true"><i v-for="y in years" :key="y" :class="{ on: y === year }" /></div>
  </div>
</template>

<style scoped>
.msum {
  padding: 8px 14px 6px; display: flex; flex-direction: column; gap: 6px; touch-action: pan-y; user-select: none;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  border-radius: 16px; box-shadow: var(--shadow-menu);
}
.dots { display: flex; justify-content: center; gap: 5px; }
.dots i { width: 6px; height: 6px; border-radius: 3px; background: var(--coastline); transition: width var(--dur-base) var(--ease); }
.dots i.on { width: 16px; background: var(--ink); }
</style>
