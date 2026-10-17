<script setup lang="ts">
// GIS 側欄（design.md 第六節「側欄」）：全國縣市清單／縣市 KV＋年份卡片＋章魚清單／鄉鎮村里清單＋年份卡片／村里年份卡片
import { computed, inject } from 'vue';
import KvTable from '../KvTable.vue';
import YearCards from '../side/YearCards.vue';
import SourceNote from '../side/SourceNote.vue';
import CountyList from './CountyList.vue';
import BellwetherList from './BellwetherList.vue';
import { countyEn } from '../../data/countyEn';
import { int } from '../../domain/format';
import { GisKey } from '../../views/useGis';

const ctx = inject(GisKey)!;
const { store } = ctx;
const s = computed(() => ctx.state.value);
const year = computed(() => ctx.currentYear.value!);
const countyName = computed(() => (s.value.county ? ctx.countyName(s.value.county) : ''));

const countyKv = computed(() => {
  void ctx.version.value;
  const y = year.value;
  const cc = store.areaCode(y, s.value.county!);
  const towns = cc ? store.baseGeo(y).towns.features.filter((f) => f.properties.COUNTYCODE === cc).length : 0;
  const vills = store.hasVillages() && cc
    ? store.allVillages(y).features.filter((f) => f.properties.VILLNAME && f.properties.COUNTYCODE === cc).length : null;
  const row = store.countyRow(y, s.value.county!);
  return [
    { label: '鄉鎮市區數', value: cc ? String(towns) : '—' },
    { label: '村里數', value: vills === null ? '…' : String(vills) },
    { label: `${y} 選舉人`, value: row ? int(row.electors) : '—' },
  ];
});

/** 鄉鎮內村里清單：目前屆次的開票列（未開票時用圖資），每列村里名＋代碼末三碼 */
const villages = computed(() => {
  void ctx.version.value;
  const town = s.value.town;
  if (!town || !store.hasVillages()) return [];
  const y = year.value;
  if (store.meta.hasResults(y)) {
    return store.villageRowsOfTown(y, town).map((r) => ({
      id: r.moi.length ? store.villageIdOf(y, r.moi[0]) : `n:${r.name}`,
      name: r.name,
      code: r.moi.length ? r.moi[0].slice(-3) : '',
    }));
  }
  return store.villagesOfTown(y, town).features.filter((f) => f.properties.VILLNAME).map((f) => ({
    id: store.villageIdOf(y, f.properties.VILLCODE), name: f.properties.VILLNAME.replace(/[[\]]/g, ''), code: f.properties.VILLCODE.slice(-3),
  }));
});

/** 村里名稱要等村里資料載入後才查得到，所以依 version 重算 */
const villageTitle = computed(() => {
  void ctx.version.value;
  return s.value.village && s.value.town ? ctx.villageName(s.value.village, s.value.town) || '…' : '';
});

const villageCode = computed(() => {
  const v = s.value.village;
  if (!v || v.startsWith('n:')) return '';
  return v.includes(':') ? v.split(':')[1] : v;
});
const pendingText = computed(() => (ctx.load.value.kind === 'error' ? '連線中斷 · 村里圖資' : '正在接收村里圖資…'));
</script>

<template>
  <div class="panel">
    <template v-if="!s.county">
      <div>
        <div class="eyebrow">National · {{ year }}</div>
        <h1>直轄市長及縣市長</h1>
        <div class="sub">縮放至 8.5 級顯示鄉鎮市區，12 級顯示村里</div>
      </div>
      <CountyList />
    </template>

    <template v-else-if="!s.town">
      <div>
        <div class="eyebrow">County · {{ s.county }}</div>
        <h1>{{ countyName }}</h1>
        <div class="sub">{{ countyEn(countyName) }}</div>
      </div>
      <KvTable :items="countyKv" />
      <YearCards level="county" :county="countyName" />
      <BellwetherList />
    </template>

    <template v-else-if="!s.village">
      <div>
        <div class="eyebrow">Township · {{ s.town }}</div>
        <h1>{{ ctx.townName(s.town) }}</h1>
        <div class="sub">{{ countyName }} · {{ countyEn(countyName) }}</div>
      </div>
      <div class="block">
        <div class="label">村里</div>
        <div v-if="villages.length" class="vlist">
          <button v-for="v in villages" :key="v.id" type="button" @click="ctx.pick('village', v.id, s.town)">
            <span>{{ v.name }}</span><span class="code">{{ v.code }}</span>
          </button>
        </div>
        <div v-else-if="!store.hasVillages()" class="empty">{{ pendingText }}</div>
        <div v-else class="empty">本屆無資料</div>
      </div>
      <YearCards level="town" :county="countyName" />
    </template>

    <template v-else>
      <div>
        <div class="eyebrow">Village{{ villageCode ? ` · ${villageCode}` : '' }}</div>
        <h1>{{ villageTitle }}</h1>
        <div class="sub">{{ countyName }} · {{ ctx.townName(s.town) }}</div>
      </div>
      <YearCards level="village" :county="countyName" />
    </template>

    <SourceNote />
  </div>
</template>

<style scoped>
.panel { display: flex; flex-direction: column; gap: var(--s-6); }
.block { display: flex; flex-direction: column; gap: var(--s-3); }
.vlist { max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; border: 1px solid var(--hairline); border-radius: var(--r-md); }
.vlist button {
  display: flex; justify-content: space-between; gap: var(--s-3); padding: 6px var(--s-3); border: 0; background: none;
  font: inherit; font-size: var(--text-sm); color: var(--ink); text-align: left; cursor: pointer;
}
.vlist button:hover { background: var(--hover); }
.code { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-3); }
.empty { font-size: var(--text-sm); color: var(--ink-3); }
/* 窄螢幕側欄縮成 360px，KV 的大數字（選舉人數）會被截掉 */
@media (max-width: 1100px) { .panel :deep(.kv b) { font-size: var(--text-md); } }
</style>
