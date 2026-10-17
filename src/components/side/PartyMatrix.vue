<script setup lang="ts">
// 全國側欄：22 縣市 × 各屆的當選政黨
import { computed, inject } from 'vue';
import { CompareKey } from '../../views/useCompare';

// 縣市排序（依原型）
const ORDER = ['臺北市', '新北市', '桃園市', '臺中市', '臺南市', '高雄市', '基隆市', '新竹市', '新竹縣', '苗栗縣', '彰化縣',
  '南投縣', '雲林縣', '嘉義縣', '嘉義市', '屏東縣', '宜蘭縣', '花蓮縣', '臺東縣', '澎湖縣', '金門縣', '連江縣'];

const ctx = inject(CompareKey)!;
const years = computed(() => ctx.store.meta.years());

const rows = computed(() => {
  void ctx.version.value;
  const { store } = ctx;
  const base = store.baseGeo(store.meta.baseYear()).counties.features;
  const byName = new Map(base.map((f) => [f.properties.COUNTYNAME, f.properties.COUNTYCODE]));
  return ORDER.filter((n) => byName.has(n)).map((name) => {
    const code = byName.get(name)!;
    const cells = years.value.map((y) => {
      if (!store.meta.hasResults(y)) return { year: y, text: `${store.meta.contest(y, name)?.candidates.length ?? 0} 人`, color: null, flip: false, title: '' };
      const r = store.countyRow(y, code);
      if (!r) return { year: y, text: '—', color: null, flip: false, title: '' };
      const c = store.meta.candidate(r.winner);
      const p = store.meta.partyOfCandidate(r.winner);
      return { year: y, text: c.name, color: p.color, flip: r.flipped === true, title: `${c.name}（${p.label}）` };
    });
    return { name, code, cells };
  });
});
</script>

<template>
  <div class="matrix">
    <div class="mh"><span>縣市</span><span v-for="y in years" :key="y">{{ y }}</span></div>
    <button v-for="r in rows" :key="r.code" type="button" class="row" @click="ctx.set({ county: r.code, town: null, village: null })">
      <span class="cn">{{ r.name }}</span>
      <span v-for="c in r.cells" :key="c.year" class="cell" :title="c.title">
        <i v-if="c.color" class="dot" :style="{ background: c.color }" />
        <span>{{ c.text }}</span>
        <i v-if="c.flip" class="flipm" />
      </span>
    </button>
  </div>
</template>

<style scoped>
.matrix { display: flex; flex-direction: column; border: 1px solid var(--hairline); border-radius: var(--r-md); overflow: hidden; }
.mh, .row { display: grid; grid-template-columns: 52px repeat(4, minmax(0, 1fr)); align-items: center; gap: 4px; padding: 0 10px; }
.mh { height: 32px; font-family: var(--font-mono); font-size: var(--text-2xs); color: var(--ink-2); letter-spacing: var(--ls-label); border-bottom: 1px solid var(--hairline); }
.row { height: 30px; cursor: pointer; font-size: var(--text-xs); border: 0; background: none; text-align: left; width: 100%; }
.row:hover { background: var(--hover); }
.row + .row { border-top: 1px solid var(--hairline); }
.cn { color: var(--ink); font-size: var(--text-sm); }
.cell { display: flex; align-items: center; gap: 4px; color: var(--ink-2); white-space: nowrap; overflow: hidden; min-width: 0; font-size: var(--text-2xs); }
.cell > span { overflow: hidden; text-overflow: clip; }
.cell .dot { width: 10px; height: 10px; }
.flipm { width: 4px; height: 4px; border-radius: 50%; background: var(--flip); flex: none; }
@media (max-width: 1280px) { .cell > span { display: none; } }
</style>
