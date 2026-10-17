<script setup lang="ts">
import SegmentedControl from './SegmentedControl.vue';
import type { Layer } from '../data/types';

defineProps<{ layer: Layer }>();
const emit = defineEmits<{ 'update:layer': [layer: Layer] }>();

const views = [
  { value: 'compare', label: '四屆比較' },
  { value: 'gis', label: '地理資訊圖台', disabled: true, title: '即將推出' },
];
const layers = [
  { value: 'party', label: '當選政黨' },
  { value: 'margin', label: '得票差距' },
  { value: 'turnout', label: '投票率' },
  { value: 'flip', label: '政黨輪替' },
];
const onLayer = (v: string) => emit('update:layer', v as Layer);
</script>

<template>
  <header class="top">
    <div class="brand"><b>九合一選舉圖台</b><span>Mayoral · 2014–2026</span></div>
    <slot />
    <SegmentedControl class="views" :options="views" model-value="compare" />
    <SegmentedControl :options="layers" :model-value="layer" @update:model-value="onLayer" />
  </header>
</template>

<style scoped>
.top {
  display: flex; align-items: center; gap: var(--s-6); padding: 0 var(--s-5);
  border-bottom: 1px solid var(--hairline); background: var(--paper); min-width: 0;
}
.brand { display: flex; flex-direction: column; line-height: 1.15; flex: none; }
.brand b { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); letter-spacing: -.01em; }
.brand span {
  font-family: var(--font-mono); font-size: var(--text-2xs); letter-spacing: var(--ls-label);
  color: var(--ink-2); text-transform: uppercase; white-space: nowrap;
}
.views { margin-left: auto; }
</style>
