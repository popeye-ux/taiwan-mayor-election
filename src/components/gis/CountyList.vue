<script setup lang="ts">
// GIS 全國側欄：22 縣市（目前屆次的第一名、輪替、得票率；未開票顯示參選人數）
import { computed, inject } from 'vue';
import Chip from '../Chip.vue';
import { COUNTY_ORDER } from '../../data/countyEn';
import { pct1 } from '../../domain/format';
import { GisKey } from '../../views/useGis';

const ctx = inject(GisKey)!;

const rows = computed(() => {
  void ctx.version.value;
  const { store } = ctx;
  const y = ctx.currentYear.value!;
  const base = store.baseGeo(store.meta.baseYear()).counties.features;
  const byName = new Map(base.map((f) => [f.properties.COUNTYNAME, f.properties.COUNTYCODE]));
  return COUNTY_ORDER.filter((n) => byName.has(n)).map((name) => {
    const code = byName.get(name)!;
    if (!store.meta.hasResults(y)) {
      return { code, name, color: null, winner: `${store.meta.contest(y, name)?.candidates.length ?? 0} 位參選人`, flip: false, pct: '' };
    }
    const r = store.countyRow(y, code);
    if (!r) return { code, name, color: null, winner: '—', flip: false, pct: '' };
    return {
      code, name, color: store.meta.partyOfCandidate(r.winner).color, winner: store.meta.candidate(r.winner).name,
      flip: r.flipped === true, pct: pct1(r.votes[0][2]),
    };
  });
});
</script>

<template>
  <div class="list">
    <button v-for="r in rows" :key="r.code" type="button" class="row" @click="ctx.pick('county', r.code)">
      <span class="cn">{{ r.name }}</span>
      <span class="w">
        <i v-if="r.color" class="dot" :style="{ background: r.color }" />
        <span>{{ r.winner }}</span>
        <Chip v-if="r.flip" tone="flip">輪替</Chip>
      </span>
      <span class="pc">{{ r.pct }}</span>
    </button>
  </div>
</template>

<style scoped>
.list { display: flex; flex-direction: column; }
.row {
  display: grid; grid-template-columns: 64px minmax(0, 1fr) auto; align-items: center; gap: var(--s-3);
  height: 32px; padding: 0 var(--s-2); border: 0; background: none; border-radius: var(--r-sm, 6px);
  font: inherit; font-size: var(--text-sm); color: var(--ink); text-align: left; cursor: pointer;
}
.row:hover { background: var(--hover); }
.cn { color: var(--ink-2); }
.w { display: flex; align-items: center; gap: 6px; min-width: 0; }
.w > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pc { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); }
</style>
