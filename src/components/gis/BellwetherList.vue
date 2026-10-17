<script setup lang="ts">
// GIS 縣市層：章魚清單。「穩定章魚區」每一屆都符合；「{year} 章魚區」只看目前屆次。
import { computed, inject } from 'vue';
import { BW_MAX, BW_MIN_VALID, currentBellwethers, stableBellwethers, type BwCandidate, type BwEntry } from '../../domain/bellwether';
import { GisKey } from '../../views/useGis';
import { bwCandidates } from '../../views/gisSelect';

const ctx = inject(GisKey)!;
const LEVELS = [{ level: 'town', label: '鄉鎮市區' }, { level: 'village', label: '村里' }] as const;

const lists = computed(() => {
  void ctx.version.value;
  const { store } = ctx;
  const county = ctx.state.value.county!;
  const y = ctx.currentYear.value!;
  const years = store.meta.resultYears();
  return LEVELS.map(({ level, label }) => {
    const ready = level === 'town' || store.hasVillages();
    const byYear = new Map<number, BwCandidate[]>(ready ? years.map((ry) => [ry, bwCandidates(store, ry, county, level)]) : []);
    return {
      level, label, ready,
      stable: ready ? stableBellwethers(byYear, years, level) : [],
      current: ready && store.meta.hasResults(y) ? currentBellwethers(byYear.get(y) ?? [], level) : [],
    };
  });
});

const years = computed(() => ctx.store.meta.resultYears());
const showCurrent = computed(() => ctx.currentYear.value !== null && ctx.store.meta.hasResults(ctx.currentYear.value));
const pendingText = computed(() => (ctx.load.value.kind === 'error' ? '連線中斷 · 村里圖資' : '正在接收村里圖資…'));
const dev = (d: number) => d.toFixed(2);

function go(level: 'town' | 'village', e: BwEntry) {
  if (level === 'town') ctx.pick('town', e.id);
  else ctx.pick('village', e.id, e.town);
}
</script>

<template>
  <div class="bw">
    <div class="h">
      <div class="label">章魚區</div>
      <p class="note">偏差 ≤ {{ BW_MAX }} pp 且第一名與全縣市相同；村里有效票 ≥ {{ BW_MIN_VALID }}</p>
    </div>
    <div v-for="l in lists" :key="l.level" class="sec">
      <div class="sub">穩定章魚{{ l.label }}<span class="mono">{{ years.join(' / ') }}</span></div>
      <div v-if="!l.ready" class="empty">{{ pendingText }}</div>
      <template v-else>
        <button v-for="e in l.stable" :key="e.id" type="button" class="row" @click="go(l.level, e)">
          <span class="nm">{{ e.name }}</span>
          <span class="mono devs">{{ e.devs.map(dev).join(' / ') }}</span>
          <span class="mono mean">{{ dev(e.mean) }}</span>
        </button>
        <div v-if="!l.stable.length" class="empty">沒有每一屆都符合的{{ l.label }}</div>
      </template>
      <template v-if="showCurrent && l.ready">
        <div class="sub">{{ ctx.currentYear.value }} 章魚{{ l.label }}</div>
        <button v-for="e in l.current" :key="e.id" type="button" class="row" @click="go(l.level, e)">
          <span class="nm">{{ e.name }}</span>
          <span />
          <span class="mono mean">{{ dev(e.mean) }}</span>
        </button>
        <div v-if="!l.current.length" class="empty">本屆沒有符合的{{ l.label }}</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.bw { display: flex; flex-direction: column; gap: var(--s-4); }
.h { display: flex; flex-direction: column; gap: var(--s-1, 4px); }
.note { margin: 0; font-size: var(--text-xs); color: var(--ink-3); }
.sec { display: flex; flex-direction: column; gap: 2px; }
.sub { display: flex; justify-content: space-between; font-size: var(--text-xs); color: var(--ink-2); padding: var(--s-2) 0 var(--s-1, 4px); }
.mono { font-family: var(--font-mono); }
.row {
  display: grid; grid-template-columns: minmax(0, 1fr) auto 48px; gap: var(--s-3); align-items: center;
  height: 30px; padding: 0 var(--s-2); border: 0; background: none; border-radius: 6px;
  font: inherit; font-size: var(--text-sm); color: var(--ink); text-align: left; cursor: pointer;
}
.row:hover { background: var(--hover); }
.nm { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.devs { font-size: var(--text-xs); color: var(--ink-2); }
.mean { font-size: var(--text-xs); text-align: right; }
.empty { font-size: var(--text-sm); color: var(--ink-3); padding: 0 var(--s-2); }
</style>
