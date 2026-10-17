<script setup lang="ts">
import { computed, inject } from 'vue';
import Chip from '../Chip.vue';
import type { Level, ResultRow } from '../../data/types';
import { stackSegments } from '../../domain/stack';
import { int, pct2, pp2 } from '../../domain/format';
import { BORROWED_NOTE, ViewKey } from '../../views/common';

const props = defineProps<{
  year: number; row: ResultRow | undefined; level: Level; county: string; flipped: boolean | null; preview: boolean;
  /** 村里資料還沒到時顯示的文字（不顯示「本屆無資料」） */
  pending?: string | null;
  /** GIS 目前顯示的屆次 */
  current?: boolean;
  /** 這一屆的形狀借用其他屆圖資 */
  borrowed?: boolean;
}>();
const ctx = inject(ViewKey)!;
const meta = ctx.store.meta;

const voteDay = computed(() => {
  const e = meta.meta.elections.find((x) => x.year === props.year);
  if (!e) return '';
  const [, m, d] = e.vote_date.split('-').map(Number);
  return `${m}/${d} 投票`;
});
const candidates = computed(() => (props.preview ? meta.contest(props.year, props.county)?.candidates ?? [] : []));
const segs = computed(() => (props.row ? stackSegments(props.row, meta) : []));
const winLabel = computed(() => (props.level === 'county' ? '當選' : '第一名'));
</script>

<template>
  <div class="yb" :class="{ pre: preview || current }">
    <div class="yb-h">
      <b>{{ year }}</b>
      <span v-if="preview" class="mono day">{{ voteDay }}</span>
      <Chip v-else-if="flipped === true" tone="flip">政黨輪替</Chip>
      <Chip v-else-if="flipped === false">延續執政</Chip>
    </div>
    <div v-if="pending && !preview" class="empty">{{ pending }}</div>
    <template v-else-if="preview">
      <div v-for="c in candidates" :key="c.id" class="cand">
        <span class="nm"><i class="dot" :style="{ background: meta.party(c.party).color }" /><span>{{ c.name }}</span><Chip>{{ meta.party(c.party).label }}</Chip></span>
        <span class="pc">—</span><span class="vv" />
      </div>
      <div v-if="!candidates.length" class="empty">尚無參選人資料</div>
    </template>
    <template v-else-if="row">
      <div class="sbar"><i v-for="(s, i) in segs" :key="i" :style="{ background: s.color, flex: s.pct }" :title="`${s.label} ${s.pct}%`" /></div>
      <div v-for="([id, votes, pct], i) in row.votes" :key="id" class="cand" :class="{ win: i === 0 }">
        <span class="nm">
          <i class="dot" :style="{ background: meta.partyOfCandidate(id).color }" /><span>{{ meta.candidate(id).name }}</span>
          <Chip v-if="i === 0" tone="win">{{ winLabel }}</Chip>
        </span>
        <span class="pc">{{ pct2(pct) }}</span>
        <span class="vv">{{ int(votes) }}</span>
      </div>
      <div class="meta">
        <span>投票率 <b>{{ pct2(row.turnout) }}</b></span>
        <span>差距 <b>{{ pp2(row.margin_pp) }}</b></span>
        <span><b>{{ int(row.margin_votes) }}</b> 票</span>
      </div>
    </template>
    <div v-else class="empty">本屆無資料</div>
    <div v-if="borrowed" class="note">{{ BORROWED_NOTE }}</div>
  </div>
</template>

<style scoped>
.yb { border: 1px solid var(--hairline); border-radius: var(--r-md); padding: var(--s-4); display: flex; flex-direction: column; gap: var(--s-3); }
.yb.pre { box-shadow: var(--inner-signal); }
.yb-h { display: flex; justify-content: space-between; align-items: baseline; }
.yb-h b { font-family: var(--font-display); font-weight: 700; font-size: var(--text-lg); letter-spacing: -.01em; }
.day { font-size: var(--text-xs); color: var(--accent); }
.sbar { display: flex; height: 8px; border-radius: var(--r-full); overflow: hidden; gap: 1px; background: var(--hover); }
.sbar i { display: block; height: 100%; }
.cand { display: grid; grid-template-columns: minmax(0, 1fr) auto 64px; gap: 8px; align-items: center; font-size: var(--text-sm); }
.nm { display: flex; align-items: center; gap: 6px; min-width: 0; }
.nm > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cand.win .nm > span { font-weight: 500; }
.pc { font-family: var(--font-mono); font-size: var(--text-sm); text-align: right; }
.vv { font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); text-align: right; }
.meta { display: flex; flex-wrap: wrap; gap: var(--s-4); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--ink-2); }
.meta b { color: var(--ink); font-weight: 500; }
.empty { font-size: var(--text-sm); color: var(--ink-3); }
.note { font-size: var(--text-xs); color: var(--ink-3); }
</style>
