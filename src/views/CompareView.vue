<script setup lang="ts">
import { ref } from 'vue';
import TopBar from '../components/TopBar.vue';
import Breadcrumbs from '../components/Breadcrumbs.vue';
import Legend from '../components/Legend.vue';
import ZoomControl from '../components/ZoomControl.vue';
import type { Layer } from '../data/types';

// 欄頭英文小標（固定文案）
const YL: Record<number, string> = { 2014: '第一次九合一', 2018: '第二次九合一', 2022: '第三次九合一', 2026: '第四次 · 11/28 投票' };
const years = [2014, 2018, 2022, 2026];
const layer = ref<Layer>('party');
</script>

<template>
  <div class="app">
    <TopBar v-model:layer="layer">
      <Breadcrumbs :items="[{ label: '全國', to: null }]" />
    </TopBar>
    <div class="main">
      <section class="maps">
        <div v-for="y in years" :key="y" class="pane" :class="{ pre: y === 2026 }">
          <div class="pane-h">
            <div class="yr"><b>{{ y }}</b><span>{{ YL[y] ?? '' }}</span></div>
            <div class="sum" />
          </div>
          <div class="map" />
        </div>
        <Legend :layer="layer" :parties="[]" />
        <ZoomControl />
      </section>
      <aside class="side"><div class="side-in" /></aside>
    </div>
  </div>
</template>

<style scoped>
.app { display: grid; grid-template-rows: var(--topbar-height) 1fr; height: 100vh; min-width: 900px; }
.main { display: grid; grid-template-columns: minmax(0, 1fr) clamp(320px, 34vw, 440px); min-height: 0; }
.maps { position: relative; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 1px; background: var(--hairline); min-height: 0; }
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
.map { flex: 1; min-height: 0; position: relative; }
.side { border-left: 1px solid var(--hairline); background: var(--surface); overflow-y: auto; min-height: 0; }
.side-in { padding: var(--s-6); display: flex; flex-direction: column; gap: var(--s-6); }
@media (max-width: 1280px) {
  .yr span { display: none; }
  .side-in { padding: var(--s-5); }
}
</style>
