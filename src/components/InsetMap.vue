<script setup lang="ts">
// 全國層左上的連江、金門插圖框（d3-geo SVG）
import { computed } from 'vue';
import { geoArea, geoMercator, geoPath } from 'd3-geo';
import type { Feature, Geometry, MultiPolygon } from 'geojson';
import type { CountyProps } from '../data/types';

const props = defineProps<{ features: Feature<Geometry, CountyProps>[]; fillOf: (code: string) => string }>();
const emit = defineEmits<{ pick: [code: string]; hover: [code: string | null, ev: MouseEvent] }>();

const W = 64;
const H = 58;
const BOXES = [{ code: '09007', label: '連江' }, { code: '09020', label: '金門' }];

/** 只用主要島嶼決定縮放（面積達最大島 5% 以上），避免遠處小島（如烏坵）把本島縮得太小 */
function mainParts(f: Feature<Geometry, CountyProps>): Feature {
  if (f.geometry.type !== 'MultiPolygon') return f;
  const polys = f.geometry.coordinates;
  const areas = polys.map((c) => geoArea({ type: 'Polygon', coordinates: c }));
  const max = Math.max(...areas);
  const geometry: MultiPolygon = { type: 'MultiPolygon', coordinates: polys.filter((_, i) => areas[i] >= max * 0.05) };
  return { ...f, geometry };
}

const boxes = computed(() => BOXES.map((b) => {
  const f = props.features.find((x) => x.properties.COUNTYCODE === b.code);
  if (!f) return { ...b, d: null };
  const proj = geoMercator().fitExtent([[6, 12], [W - 6, H - 6]], mainParts(f));
  return { ...b, d: geoPath(proj)(f) };
}));
</script>

<template>
  <div class="insets">
    <svg v-for="b in boxes" :key="b.code" :width="W" :height="H" :viewBox="`0 0 ${W} ${H}`">
      <rect x="0.5" y="0.5" :width="W - 1" :height="H - 1" rx="4" class="frame" />
      <text x="5" y="10" class="lab">{{ b.label }}</text>
      <path
        v-if="b.d" :d="b.d" :fill="fillOf(b.code)" class="ar"
        @click="emit('pick', b.code)"
        @mousemove="emit('hover', b.code, $event)"
        @mouseleave="emit('hover', null, $event)"
      />
    </svg>
  </div>
</template>

<style scoped>
.insets { position: absolute; left: var(--s-3); top: var(--s-3); display: flex; flex-direction: column; gap: 6px; z-index: 4; }
.frame { fill: none; stroke: var(--coastline); stroke-dasharray: 2 4; }
.lab { font-family: var(--font-mono); font-size: 9px; fill: var(--ink-3); letter-spacing: .08em; }
.ar { stroke: #fff; stroke-width: .6; cursor: pointer; }
.ar:hover { stroke: var(--ink); stroke-width: 1.4; }
</style>
