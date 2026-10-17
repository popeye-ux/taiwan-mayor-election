<script setup lang="ts">
import { computed, provide, ref } from 'vue';
import TopBar from '../components/TopBar.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import Legend from '../components/Legend.vue';
import ZoomControl from '../components/ZoomControl.vue';
import Tooltip from '../components/Tooltip.vue';
import StatusBar from '../components/StatusBar.vue';
import ComparePane from '../components/ComparePane.vue';
import PaneSummary, { type Summary } from '../components/PaneSummary.vue';
import InsetMap from '../components/InsetMap.vue';
import SidePanel from '../components/side/SidePanel.vue';
import type { Layer, Party } from '../data/types';
import { webglSupported, type PaneHit } from '../map/pane';
import { seatsByParty } from '../domain/national';
import { pct1, ppSigned1 } from '../domain/format';
import { useCompare, levelOf, CompareKey } from './useCompare';

// 欄頭英文小標（固定文案）
const YL: Record<number, string> = { 2014: '第一次九合一', 2018: '第二次九合一', 2022: '第三次九合一', 2026: '第四次 · 11/28 投票' };

const ctx = useCompare();
provide(CompareKey, ctx);
const { store, status, villageStatus, version, state, set, tooltip } = ctx;
const webgl = ref(webglSupported());

const ready = computed(() => status.value === 'ready');
const years = computed(() => (version.value && ready.value ? store.meta.years() : []));

const legendParties = computed<Party[]>(() => {
  if (!version.value || !ready.value) return [];
  const shorts = ['KMT', 'DPP', 'TPP', 'IND'];
  return shorts.map((s) => store.meta.meta.parties.find((p) => p.short === s)).filter((p): p is Party => !!p);
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

function summaryFor(year: number): Summary {
  void version.value;
  const s = state.value;
  const preview = !store.meta.hasResults(year);
  if (levelOf(s) === 'national') {
    if (preview) {
      const contests = store.meta.meta.contests.filter((c) => c.year === year);
      const n = contests.reduce((t, c) => t + c.candidates.length, 0);
      return { kind: 'text', title: `${contests.length} 席 · ${n} 位參選人`, line: '尚未開票' };
    }
    const rows = store.countyRows(year);
    return {
      kind: 'seats', total: rows.length,
      items: seatsByParty(rows, store.meta).map((x) => ({ color: x.party.color, label: x.party.label.replace(/黨$/, ''), seats: x.seats })),
    };
  }
  if (preview) {
    const n = store.meta.contest(year, ctx.countyName(s.county!))?.candidates.length ?? 0;
    return { kind: 'text', title: `${n} 位參選人`, line: '尚未開票' };
  }
  const row = ctx.rowAt(year);
  if (!row) return { kind: 'none' };
  return {
    kind: 'winner',
    color: store.meta.partyOfCandidate(row.winner).color,
    name: store.meta.candidate(row.winner).name,
    flipped: ctx.flipAt(year),
    line: `${pct1(row.votes[0][2])} · ${ppSigned1(row.margin_pp)} · ${pct1(row.turnout)}`,
  };
}

function insetFeatures(year: number) {
  return store.baseGeo(year).counties.features;
}
function insetHover(year: number, code: string | null, ev: MouseEvent) {
  const f = code ? insetFeatures(year).find((x) => x.properties.COUNTYCODE === code) : null;
  const hit: PaneHit | null = f ? { source: 'counties', code: code!, props: { ...f.properties } } : null;
  ctx.showTip(year, hit, ev);
}

const villageText = computed(() =>
  villageStatus.value === 'loading' ? '正在接收村里圖資…' : villageStatus.value === 'error' ? '連線中斷 · 村里圖資' : null);


const setLayer = (layer: Layer) => set({ layer });
const reload = () => location.reload();
</script>

<template>
  <div class="app">
    <TopBar :layer="state.layer" @update:layer="setLayer">
      <Breadcrumbs :items="crumbs" @go="set" />
    </TopBar>
    <div class="main">
      <section class="maps">
        <template v-if="ready && webgl">
          <ComparePane
            v-for="y in years" :key="y" :year="y" :label="YL[y] ?? ''" :preview="!store.meta.hasResults(y)"
            @ready="(p) => ctx.registerPane(y, p)" @failed="webgl = false" @resize="ctx.resized"
          >
            <template #summary><PaneSummary :summary="summaryFor(y)" /></template>
            <InsetMap
              v-if="!state.county" :features="insetFeatures(y)" :fill-of="(c) => ctx.countyFill(y, c)"
              @pick="(c) => set({ county: c, town: null, village: null })" @hover="(c, ev) => insetHover(y, c, ev)"
            />
          </ComparePane>
          <Legend :layer="state.layer" :parties="legendParties" />
          <ZoomControl @zoom="ctx.zoom" />
          <StatusBar :text="villageText" :retry="villageStatus === 'error'" @retry="ctx.retryVillages" />
        </template>
        <div v-else class="center">
          <span v-if="!webgl">此瀏覽器不支援 WebGL，無法顯示地圖</span>
          <button v-else-if="status === 'error'" type="button" @click="reload">連線中斷 · 重新整理</button>
          <span v-else>正在載入圖資…</span>
        </div>
      </section>
      <aside class="side"><div class="side-in"><SidePanel v-if="ready" /></div></aside>
    </div>
    <Tooltip :x="tooltip?.x ?? 0" :y="tooltip?.y ?? 0" :lines="tooltip?.lines ?? null" />
  </div>
</template>

<style scoped>
.app { display: grid; grid-template-rows: var(--topbar-height) 1fr; height: 100vh; min-width: 900px; }
.main { display: grid; grid-template-columns: minmax(0, 1fr) clamp(320px, 34vw, 440px); min-height: 0; }
.maps { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--hairline); min-height: 0; }
.center {
  grid-column: 1 / -1; display: flex; align-items: center; justify-content: center; background: var(--paper);
  font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); letter-spacing: var(--ls-label);
}
.center button { border: 1px solid var(--hairline); background: var(--surface); border-radius: var(--r-full); padding: 6px 14px; cursor: pointer; color: var(--accent); font: inherit; }
.side { border-left: 1px solid var(--hairline); background: var(--surface); overflow-y: auto; min-height: 0; }
.side-in { padding: var(--s-6); display: flex; flex-direction: column; gap: var(--s-6); }
@media (max-width: 1280px) { .side-in { padding: var(--s-5); } }
</style>
