<script setup lang="ts">
// 手機版頂部兩塊 capsule：品牌＋檢視切換＋麵包屑；年份＋圖層（圖層列放不下時左右捲動）
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import SegmentedControl from '../SegmentedControl.vue';
import type { Layer } from '../../data/types';

const props = defineProps<{ view: 'compare' | 'gis'; years: number[]; year: number; layer: Layer }>();
const emit = defineEmits<{ view: [view: 'compare' | 'gis']; year: [year: number]; layer: [layer: Layer]; height: [px: number] }>();

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

const root = ref<HTMLElement | null>(null);
const layerRow = ref<HTMLElement | null>(null);
// 兩塊合計的下緣（含上方 8px 間距），抽屜全開高度與地圖對準都要用
const observer = new ResizeObserver(() => {
  if (root.value) emit('height', root.value.getBoundingClientRect().bottom);
});
onMounted(() => observer.observe(root.value!));
/** 呼叫當下量的下緣（ResizeObserver 的值可能還沒更新，地圖對準時用這個） */
defineExpose({ bottom: () => root.value?.getBoundingClientRect().bottom ?? 0 });
onBeforeUnmount(() => observer.disconnect());

/** 選中的圖層捲進可見範圍 */
async function revealLayer() {
  await nextTick();
  layerRow.value?.querySelector<HTMLElement>('button.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
watch(() => props.layer, revealLayer);
onMounted(revealLayer);
</script>

<template>
  <div ref="root" class="mtop">
    <div class="cap">
      <div class="r">
        <b class="brand">九合一選舉圖台</b>
        <SegmentedControl :options="views" :model-value="view" @update:model-value="(v) => v !== view && emit('view', v as 'compare' | 'gis')" />
      </div>
      <div class="crumb-row"><slot /></div>
    </div>
    <div class="cap">
      <SegmentedControl
        class="years" mono :options="years.map((y) => ({ value: String(y), label: String(y) }))" :model-value="String(year)"
        @update:model-value="(v) => emit('year', Number(v))"
      />
      <div ref="layerRow" class="layers">
        <SegmentedControl :options="layers" :model-value="layer" @update:model-value="(v) => emit('layer', v as Layer)" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.mtop { position: fixed; top: 8px; left: 8px; right: 8px; z-index: 20; display: flex; flex-direction: column; gap: 8px; }
.cap {
  display: flex; flex-direction: column; gap: 4px; padding: 6px 8px; min-width: 0;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline);
  border-radius: 20px; box-shadow: var(--shadow-menu);
}
.r { display: flex; align-items: center; justify-content: space-between; gap: var(--s-2); min-width: 0; }
.brand { font-family: var(--font-display); font-weight: 700; font-size: var(--text-md); letter-spacing: -.01em; padding-left: var(--s-2); white-space: nowrap; }
.r :deep(.seg button) { padding: 5px 10px; }
/* 麵包屑單行，過長時省略最後一層，不能撐出橫向捲動 */
.crumb-row { min-width: 0; overflow: hidden; }
.crumb-row :deep(.crumbs) { gap: 2px; }
.crumb-row :deep(.crumbs button), .crumb-row :deep(.crumbs .cur) { padding: 4px 6px; }
.crumb-row :deep(.crumbs .cur) { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.years { border: 0; padding: 0; }
.years :deep(button) { flex: 1; }
.layers { overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
.layers::-webkit-scrollbar { display: none; }
.layers :deep(.seg) { border: 0; padding: 0; width: max-content; }
</style>
