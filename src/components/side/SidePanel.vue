<script setup lang="ts">
// 依目前層級顯示全國／縣市／鄉鎮／村里側欄
import { computed, inject } from 'vue';
import KvTable from '../KvTable.vue';
import PartyMatrix from './PartyMatrix.vue';
import YearCards from './YearCards.vue';
import SourceNote from './SourceNote.vue';
import { countyEn } from '../../data/countyEn';
import { flipCount, weightedTurnout } from '../../domain/national';
import { int, pct2 } from '../../domain/format';
import { ViewKey } from '../../views/common';

const ctx = inject(ViewKey)!;
const { store } = ctx;
const s = computed(() => ctx.state.value);
const lastResultYear = computed(() => store.meta.resultYears().at(-1)!);
const countyName = computed(() => (s.value.county ? ctx.countyName(s.value.county) : ''));

const nationalKv = computed(() => {
  void ctx.version.value;
  return store.meta.resultYears().map((y, i) => {
    const rows = store.countyRows(y);
    return { label: `${y} 投票率`, value: pct2(weightedTurnout(rows)), sub: i === 0 ? '—' : `${flipCount(rows)} 縣市輪替` };
  });
});

const countyKv = computed(() => {
  void ctx.version.value;
  const c = s.value.county!;
  const towns = store.baseGeo(store.meta.baseYear()).towns.features.filter((f) => f.properties.COUNTYCODE === c).length;
  const last = store.countyRow(lastResultYear.value, c);
  const flips = store.meta.resultYears().filter((y) => store.countyRow(y, c)?.flipped === true).length;
  return [
    { label: '鄉鎮市區數', value: String(towns) },
    { label: `${lastResultYear.value} 選舉人`, value: last ? int(last.electors) : '—' },
    { label: '輪替次數', value: String(flips) },
  ];
});

const sequence = computed(() => {
  void ctx.version.value;
  return store.meta.resultYears()
    .map((y) => store.countyRow(y, s.value.county!))
    .map((r) => (r ? store.meta.partyOfCandidate(r.winner).label : '—'))
    .join(' → ');
});

/** 鄉鎮內村里 chip：依最後一屆開票結果，含村里群組與無代碼者 */
const villageChips = computed(() => {
  void ctx.version.value;
  if (!s.value.town || !store.hasVillages()) return [];
  const y = lastResultYear.value;
  const chips = store.villageRowsOfTown(y, s.value.town).map((r) => ({
    id: r.moi.length ? store.villageIdOf(y, r.moi[0]) : `n:${r.name}`,
    name: r.name,
  }));
  // 較早屆次才有、沒有內政部代碼的村里（例如 2014 高雄「未標示村里」）補在最後
  const seen = new Set(chips.map((c) => c.id));
  for (const py of store.meta.resultYears().slice(0, -1).reverse()) {
    for (const r of store.villageRowsOfTown(py, s.value.town)) {
      const id = `n:${r.name}`;
      if (!r.moi.length && !seen.has(id)) {
        seen.add(id);
        chips.push({ id, name: r.name });
      }
    }
  }
  return chips;
});

const villageCode = computed(() => {
  const v = s.value.village;
  if (!v || v.startsWith('n:')) return '';
  return v.includes(':') ? v.split(':')[1] : v;
});
</script>

<template>
  <div class="panel">
    <template v-if="!s.county">
      <div>
        <div class="eyebrow">National Overview</div>
        <h1>直轄市長及縣市長</h1>
        <div class="sub">22 縣市 · {{ store.meta.years().join(' / ') }}</div>
      </div>
      <KvTable :items="nationalKv" />
      <div class="block">
        <div class="label">歷屆當選政黨</div>
        <PartyMatrix />
        <div class="note"><i class="flipm" />較前屆政黨輪替</div>
      </div>
    </template>

    <template v-else-if="!s.town">
      <div>
        <div class="eyebrow">County · {{ s.county }}</div>
        <h1>{{ countyName }}</h1>
        <div class="sub">{{ countyEn(countyName) }}</div>
      </div>
      <KvTable :items="countyKv" />
      <div class="seq"><span class="label">執政序列</span><span>{{ sequence }}</span></div>
      <YearCards level="county" :county="countyName" />
    </template>

    <template v-else>
      <div>
        <div class="eyebrow">{{ s.village ? `Village${villageCode ? ` · ${villageCode}` : ''}` : `Township · ${s.town}` }}</div>
        <h1>{{ s.village ? (ctx.villageName(s.village, s.town) || '…') : ctx.townName(s.town) }}</h1>
        <div class="sub">{{ s.village ? `${countyName} · ${ctx.townName(s.town)}` : `${countyName} · ${countyEn(countyName)}` }}</div>
      </div>
      <div class="block">
        <div class="label">村里</div>
        <div v-if="villageChips.length" class="vlist">
          <button
            v-for="v in villageChips" :key="v.id" type="button" :class="{ on: v.id === s.village }"
            @click="ctx.set({ village: v.id })"
          >{{ v.name }}</button>
        </div>
        <div v-else class="empty">{{ ctx.load.value.kind === 'error' ? '連線中斷 · 村里圖資' : '正在接收村里圖資…' }}</div>
      </div>
      <YearCards :level="s.village ? 'village' : 'town'" :county="countyName" />
    </template>

    <SourceNote />
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: var(--s-6); }
.block { display: flex; flex-direction: column; gap: var(--s-3); }
.note { display: flex; align-items: center; gap: 6px; font-size: var(--text-xs); color: var(--ink-2); }
.flipm { width: 6px; height: 6px; border-radius: 50%; background: var(--flip); display: inline-block; }
.seq { display: flex; align-items: baseline; gap: var(--s-3); font-size: var(--text-sm); }
.vlist { display: flex; flex-wrap: wrap; gap: 4px; }
.vlist button {
  border: 1px solid var(--hairline); background: none; border-radius: var(--r-full); padding: 3px 9px;
  font-size: var(--text-xs); color: var(--ink-2); cursor: pointer;
}
.vlist button:hover { background: var(--hover); color: var(--ink); border-color: var(--coastline); }
.vlist button.on { border-color: var(--selected); color: var(--ink); background: var(--hover); }
.empty { font-size: var(--text-sm); color: var(--ink-3); }
</style>
