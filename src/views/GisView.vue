<script setup lang="ts">
import { computed, nextTick, provide, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import GisTop from '../components/gis/GisTop.vue';
import GisSide from '../components/gis/GisSide.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import Legend from '../components/Legend.vue';
import Tooltip from '../components/Tooltip.vue';
import StatusBar from '../components/StatusBar.vue';
import MobileTop from '../components/mobile/MobileTop.vue';
import MobileDrawer from '../components/mobile/MobileDrawer.vue';
import type { Layer, Party } from '../data/types';
import { createGisMap } from '../map/gisMap';
import { webglSupported } from '../map/pane';
import { drawerSnap, useMobile } from '../state/useMobile';
import { afterPick, selectionDeepened, snapHeights } from '../domain/mobile';
import { ViewKey } from './common';
import { useGis, GisKey } from './useGis';

const LEVEL_TEXT = { county: '縣市', town: '鄉鎮市區', village: '村里' } as const;

const ctx = useGis();
provide(ViewKey, ctx);
provide(GisKey, ctx);
const { store, status, load, version, state, set, tooltip, zoomLevel } = ctx;
const webgl = ref(webglSupported());
const mapEl = ref<HTMLElement | null>(null);
const route = useRoute();
const router = useRouter();

const ready = computed(() => status.value === 'ready');
const years = computed(() => (version.value && ready.value ? store.meta.years() : []));
const year = computed(() => ctx.currentYear.value ?? 0);

// 地圖容器在資料就緒後才出現；建立失敗（WebGL context 拿不到）時改顯示說明
watch([ready, webgl], async ([r, w]) => {
  if (!r || !w) return;
  await nextTick();
  if (!mapEl.value) return;
  try {
    ctx.registerMap(createGisMap(mapEl.value));
  } catch {
    webgl.value = false;
  }
}, { immediate: true });

const legendParties = computed<Party[]>(() => {
  if (!version.value || !ready.value) return [];
  return ['KMT', 'DPP', 'TPP', 'IND'].map((s) => store.meta.meta.parties.find((p) => p.short === s)).filter((p): p is Party => !!p);
});

const crumbs = computed(() => {
  void version.value;
  const s = state.value;
  const items: { label: string; to: Partial<typeof s> | null }[] = [{ label: '全國', to: { county: null, town: null, village: null } }];
  if (ready.value && s.county) items.push({ label: ctx.countyName(s.county), to: { town: null, village: null } });
  if (ready.value && s.town) items.push({ label: ctx.townName(s.town), to: { village: null } });
  if (ready.value && s.town && s.village && store.hasVillages()) items.push({ label: ctx.villageName(s.village, s.town), to: null });
  items[items.length - 1].to = null;
  return items;
});

const LOAD_TEXT = { villages: '連線中斷 · 村里圖資', towns: '連線中斷 · 鄉鎮資料' };
const loadText = computed(() => {
  const l = load.value;
  if (l.kind === 'loading') return '正在接收村里圖資…';
  if (l.kind === 'error') return LOAD_TEXT[l.what];
  return null;
});

const setLayer = (layer: Layer) => set({ layer });
/** 切到四屆比較：query 原樣保留 */
const toCompare = () => router.push({ path: '/', query: route.query });
const reload = () => location.reload();

// ── 手機版 ──────────────────────────────────────────────
const mobile = useMobile();
/** 頂部兩塊控制列的下緣 */
const topH = ref(0);
const topEl = ref<InstanceType<typeof MobileTop> | null>(null);
// sync：在 useGis 的 watch 對準地圖之前先把抽屜升高，padding 才會用到新的高度
watch(state, (n, o) => {
  if (mobile.value && o && selectionDeepened(o, n)) drawerSnap.value = afterPick(drawerSnap.value);
}, { flush: 'sync' });
watch(mobile, async (m, old) => {
  ctx.setPadding(m ? () => ({
    top: (topEl.value?.bottom() ?? topH.value) + 16, bottom: snapHeights(window.innerHeight, topH.value)[drawerSnap.value] + 16, left: 24, right: 24,
  }) : null);
  // 開站時由 useGis 自己對準；之後跨過門檻要等新版面排好（頂部控制列量得到）再重新對準
  if (old === undefined) return;
  await nextTick();
  ctx.reframe();
}, { immediate: true });
</script>

<template>
  <div class="gis" :class="{ m: mobile, open: mobile && drawerSnap !== 'collapsed' }">
    <div v-if="ready && webgl" ref="mapEl" class="map" />
    <div v-else class="center">
      <span v-if="!webgl">此瀏覽器不支援 WebGL，無法顯示地圖</span>
      <button v-else-if="status === 'error'" type="button" @click="reload">連線中斷 · 重新整理</button>
      <span v-else>正在載入圖資…</span>
    </div>

    <MobileTop
      v-if="mobile" ref="topEl" view="gis" :years="years" :year="year" :layer="state.layer"
      @year="ctx.setYear" @layer="setLayer" @view="toCompare" @height="(h) => (topH = h)"
    >
      <Breadcrumbs :items="crumbs" @go="set" />
    </MobileTop>
    <GisTop v-else :years="years" :year="year" :layer="state.layer" @year="ctx.setYear" @layer="setLayer" @view="toCompare">
      <Breadcrumbs :items="crumbs" @go="set" />
    </GisTop>

    <template v-if="ready && webgl">
      <div class="legend-box">
        <span class="lv">{{ year }} · {{ LEVEL_TEXT[zoomLevel] }}</span>
        <Legend :layer="state.layer" :parties="legendParties" :national="zoomLevel === 'county'" />
      </div>
      <StatusBar :text="loadText" :retry="load.kind === 'error'" @retry="ctx.retry" />
    </template>

    <MobileDrawer v-if="mobile" :top-h="topH" :reset-key="`${state.county}|${state.town}|${state.village}`"><GisSide v-if="ready" /></MobileDrawer>
    <aside v-else class="side"><GisSide v-if="ready" /></aside>
    <Tooltip :x="tooltip?.x ?? 0" :y="tooltip?.y ?? 0" :lines="tooltip?.lines ?? null" />
  </div>
</template>

<style scoped>
.gis { position: fixed; inset: 0; background: var(--paper); }
@media (min-width: 761px) { .gis { min-width: 900px; } }
.map { position: fixed; inset: 0; }
.center {
  position: fixed; inset: 0; display: flex; align-items: center; justify-content: center;
  font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); letter-spacing: var(--ls-label);
}
.center button { border: 1px solid var(--hairline); background: var(--surface); border-radius: var(--r-full); padding: 6px 14px; cursor: pointer; color: var(--accent); font: inherit; }
.side {
  position: fixed; top: 16px; right: 16px; bottom: 16px; width: 440px; z-index: 10; overflow-y: auto;
  padding: var(--s-6); background: var(--bg-overlay); backdrop-filter: blur(20px);
  border: 1px solid var(--hairline); border-radius: var(--r-lg, 16px); box-shadow: var(--shadow-menu);
}
.legend-box {
  position: fixed; left: 16px; bottom: 16px; z-index: 10; display: flex; align-items: center; gap: var(--s-3);
  max-width: calc(100vw - 580px); padding: 6px 6px 6px 14px;
  background: var(--bg-overlay); backdrop-filter: blur(20px); border: 1px solid var(--hairline); border-radius: var(--r-md);
}
.lv { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink); white-space: nowrap; }
/* Legend 本身在四屆比較是置中浮動；GIS 改放進左下框 */
.legend-box :deep(.legend) { position: static; transform: none; max-width: none; border: 0; background: none; backdrop-filter: none; padding: 4px 8px; }
.gis :deep(.status) { position: fixed; bottom: 24px; }
.gis :deep(.maplibregl-ctrl-bottom-right) { right: 456px; }
.gis :deep(.maplibregl-ctrl-group button) { width: 40px; height: 40px; }
@media (max-width: 1100px) {
  .side { width: 360px; }
  .gis :deep(.maplibregl-ctrl-bottom-right) { right: 376px; }
  .legend-box { max-width: calc(100vw - 424px); }
}
/* 手機版：圖例與比例尺在收合抽屜上方，抽屜拉起時隱藏；縮放靠雙指 */
.gis.m .legend-box { left: 8px; right: 8px; bottom: 128px; max-width: none; flex-wrap: wrap; padding: 4px 4px 4px 10px; }
.gis.m .legend-box :deep(.legend) { gap: var(--s-2) var(--s-3); padding: 2px 4px; }
.gis.m :deep(.maplibregl-ctrl-group) { display: none; }
.gis.m :deep(.maplibregl-ctrl-bottom-right) { right: 0; bottom: 176px; }
.gis.m :deep(.status) { bottom: 184px; }
.gis.m.open .legend-box, .gis.m.open :deep(.maplibregl-ctrl-scale) { display: none; }
</style>
