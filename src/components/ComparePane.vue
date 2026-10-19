<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref } from 'vue';
import { createPane, type PaneHandle } from '../map/pane';

/** bare：手機版不畫欄頭（屆次與摘要改在頂部控制列與摘要列） */
const props = defineProps<{ year: number; label: string; preview: boolean; bare?: boolean }>();
const emit = defineEmits<{ ready: [pane: PaneHandle]; failed: []; resize: [] }>();
const el = ref<HTMLElement | null>(null);
let pane: PaneHandle | null = null;
// 欄寬在排版完成或視窗改變時才確定，大小一變就通知上層重新量測與對準
const observer = new ResizeObserver(() => emit('resize'));

onMounted(() => {
  try {
    // MapLibre 物件不可放進 reactive
    pane = markRaw(createPane(el.value!));
    observer.observe(el.value!);
    emit('ready', pane);
  } catch {
    emit('failed');
  }
});
onBeforeUnmount(() => {
  observer.disconnect();
  pane?.destroy();
});
defineExpose({ year: props.year });
</script>

<template>
  <div class="pane" :class="{ pre: preview }">
    <div v-if="!bare" class="pane-h">
      <div class="yr"><b>{{ year }}</b><span>{{ label }}</span></div>
      <div class="sum"><slot name="summary" /></div>
    </div>
    <div class="map-wrap">
      <div ref="el" class="map" />
      <slot />
    </div>
  </div>
</template>

<style scoped>
.pane { position: relative; background: var(--paper); display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.pane-h { padding: var(--s-4) var(--s-4) var(--s-3); display: flex; flex-direction: column; gap: var(--s-2); border-bottom: 1px dashed var(--hairline); }
.yr { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.yr b { font-family: var(--font-display); font-weight: 700; font-size: var(--text-2xl); letter-spacing: -.01em; line-height: 1; }
.yr span {
  font-family: var(--font-mono); font-size: var(--text-2xs); letter-spacing: var(--ls-label);
  color: var(--ink-2); text-transform: uppercase; white-space: nowrap;
}
.pane.pre .yr b { color: var(--accent); }
.sum { height: 58px; overflow: hidden; }
.map-wrap { flex: 1; min-height: 0; position: relative; }
.map { position: absolute; inset: 0; }
@media (max-width: 1280px) { .yr span { display: none; } }
</style>
