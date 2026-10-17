// 四屆比較：把 ElectionStore、URL 狀態與四格地圖串起來。
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import type { Feature } from 'geojson';
import { ElectionStore } from '../data/store';
import { createJsonCache, latest, STALE } from '../data/cache';
import { toBaseArea } from '../data/crossYear';
import type { Layer, ResultRow } from '../data/types';
import { fillFor, NONE } from '../domain/fill';
import { flipBetween } from '../domain/flip';
import { int, pct2, pp2 } from '../domain/format';
import { mainBounds, townOfVillage } from '../geo/topo';
import { OUTER_COUNTIES, type PaneHandle, type PaneHit } from '../map/pane';
import { easeAllTo, syncCameras, zoomAll } from '../map/sync';
import { useViewState } from '../state/useViewState';
import { up, validate, type ValidateCtx, type ViewState } from '../state/url';

export type ViewLevel = 'national' | 'county' | 'town';

export const levelOf = (s: ViewState): ViewLevel => (s.town ? 'town' : s.county ? 'county' : 'national');
const stripBrackets = (s: string) => s.replace(/[[\]]/g, '');

export function useCompare() {
  const store = new ElectionStore(createJsonCache());
  const status = ref<'loading' | 'ready' | 'error'>('loading');
  const villageStatus = ref<'idle' | 'loading' | 'error'>('idle');
  /** 每次載入新資料就 +1，讓依賴 store 的 computed 重新計算 */
  const version = ref(0);
  const tooltip = shallowRef<{ x: number; y: number; lines: string[] } | null>(null);
  const { state, set, replace } = useViewState();
  const panes = new Map<number, PaneHandle>();
  const based = new Set<number>();
  let unsync: (() => void) | null = null;
  let lastTarget: string | null = null;
  const villagesLatest = latest<void>();

  // ── 查詢 ──────────────────────────────────────────────

  const baseYear = () => store.meta.baseYear();

  function prevYear(year: number): number | null {
    const ys = store.meta.years();
    const p = ys[ys.indexOf(year) - 1];
    return p !== undefined && store.meta.hasResults(p) ? p : null;
  }

  function validateCtx(withVillages: boolean): ValidateCtx {
    const g = store.baseGeo(baseYear());
    const ctx: ValidateCtx = {
      hasCounty: (c) => g.counties.features.some((f) => f.properties.COUNTYCODE === c),
      townInCounty: (t, c) => g.towns.features.some((f) => f.properties.TOWNCODE === t && f.properties.COUNTYCODE === c),
    };
    if (withVillages) {
      ctx.villageValid = (id, town) => {
        if (!id.startsWith('n:')) {
          const code = id.includes(':') ? id.split(':')[1] : id;
          if (toBaseArea(townOfVillage(code)) !== town) return false;
        }
        return store.meta.years().some((y) => store.villageCodesIn(y, id, town).length > 0 || !!store.villageRow(y, id, town));
      };
    }
    return ctx;
  }

  /** 目前選取的區域在某屆的結果列（最深一層） */
  function rowAt(year: number, s: ViewState = state.value): ResultRow | undefined {
    if (s.town && s.village) return store.villageRow(year, s.village, s.town);
    if (s.town) return store.townRow(year, s.town);
    if (s.county) return store.countyRow(year, s.county);
    return undefined;
  }

  /** 目前選取區域在某屆是否輪替；縣市層用 JSON 的 flipped */
  function flipAt(year: number, s: ViewState = state.value): boolean | null {
    const cur = rowAt(year, s);
    if (!s.town) return cur?.flipped ?? null;
    const p = prevYear(year);
    return p === null ? null : flipBetween(cur, rowAt(p, s), store.meta);
  }

  function countyName(baseCounty: string): string {
    const f = store.baseGeo(baseYear()).counties.features.find((x) => x.properties.COUNTYCODE === baseCounty);
    return f?.properties.COUNTYNAME ?? '';
  }

  function townName(baseTown: string): string {
    const f = store.baseGeo(baseYear()).towns.features.find((x) => x.properties.TOWNCODE === baseTown);
    return f ? stripBrackets(f.properties.TOWNNAME) : '';
  }

  function villageName(id: string, baseTown: string): string {
    if (id.startsWith('n:')) return id.slice(2);
    for (const y of [...store.meta.resultYears()].reverse()) {
      const r = store.villageRow(y, id, baseTown);
      if (r) return r.name;
    }
    const [y, code] = id.includes(':') ? [Number(id.split(':')[0]), id.split(':')[1]] : [baseYear(), id];
    const f = store.villagesOfTown(y, baseTown).features.find((x) => x.properties.VILLCODE === code);
    return f ? stripBrackets(f.properties.VILLNAME) : '';
  }

  // ── 填色 ──────────────────────────────────────────────

  /** 某一層的填色；level 決定畫哪個 source（全國→縣市、縣市→鄉鎮、鄉鎮→村里） */
  function fillsFor(year: number, layer: Layer, s: ViewState, level: ViewLevel): { source: 'counties' | 'towns' | 'villages'; fills: Map<string, string> } {
    const fills = new Map<string, string>();
    const preview = !store.meta.hasResults(year);
    const p = prevYear(year);
    if (level === 'national') {
      for (const f of store.baseGeo(year).counties.features) {
        const code = f.properties.COUNTYCODE;
        const row = preview ? undefined : store.rowByCode(year, 'county', code);
        fills.set(code, fillFor(layer, row, store.meta, row?.flipped ?? null));
      }
      return { source: 'counties', fills };
    }
    if (level === 'county') {
      const cc = store.areaCode(year, s.county!);
      for (const f of store.baseGeo(year).towns.features) {
        if (f.properties.COUNTYCODE !== cc) continue;
        const code = f.properties.TOWNCODE;
        const row = preview ? undefined : store.rowByCode(year, 'town', code);
        const flipped = layer === 'flip' && row && p !== null
          ? flipBetween(row, store.townRow(p, toBaseArea(code)), store.meta) : null;
        fills.set(code, fillFor(layer, row, store.meta, flipped));
      }
      return { source: 'towns', fills };
    }
    for (const f of store.villagesOfTown(year, s.town!).features) {
      const code = f.properties.VILLCODE;
      if (!f.properties.VILLNAME) continue;
      const row = preview ? undefined : store.rowByCode(year, 'village', code);
      const flipped = layer === 'flip' && row && p !== null
        ? flipBetween(row, store.villageRow(p, store.villageIdOf(year, code), s.town!), store.meta) : null;
      fills.set(code, fillFor(layer, row, store.meta, flipped));
    }
    return { source: 'villages', fills };
  }

  /** 插圖框用：全國層某縣市的顏色 */
  function countyFill(year: number, code: string): string {
    if (!store.meta.hasResults(year)) return NONE;
    const row = store.rowByCode(year, 'county', code);
    return fillFor(state.value.layer, row, store.meta, row?.flipped ?? null);
  }

  // ── 地圖 ──────────────────────────────────────────────

  function paint() {
    if (status.value !== 'ready') return;
    const s = state.value;
    const level = levelOf(s);
    for (const [year, pane] of panes) {
      if (!based.has(year)) {
        pane.setBase(store.baseGeo(year));
        based.add(year);
      }
      pane.setMode({ level, countyCode: s.county ? store.areaCode(year, s.county) : null, preview: !store.meta.hasResults(year) });
      if (level === 'town' && store.hasVillages()) pane.setVillages(store.villagesOfTown(year, s.town!));
      else pane.setVillages(null);
      // 鄉鎮層：同縣市的鄉鎮照常著色，再疊上本鄉鎮的村里
      const layers: ViewLevel[] = level === 'town' ? ['county', 'town'] : [level];
      for (const lv of layers) {
        if (lv === 'town' && !store.hasVillages()) continue;
        const { source, fills } = fillsFor(year, s.layer, s, lv);
        pane.setFills(source, fills);
      }
      pane.setSelected('villages', s.town && s.village && store.hasVillages() ? store.villageCodesIn(year, s.village, s.town) : []);
    }
  }

  function targetBounds(s: ViewState) {
    const g = store.baseGeo(baseYear());
    let feats: Feature[];
    if (s.town) feats = g.towns.features.filter((f) => f.properties.TOWNCODE === s.town);
    else if (s.county) feats = g.counties.features.filter((f) => f.properties.COUNTYCODE === s.county);
    else feats = g.counties.features.filter((f) => !OUTER_COUNTIES.includes(f.properties.COUNTYCODE));
    return mainBounds(feats);
  }

  /** 四張地圖都建立後才移動；回傳是否真的移動了 */
  function frame(instant: boolean): boolean {
    const s = state.value;
    if (panes.size < store.meta.years().length) return false;
    const maps = [...panes.values()].map((p) => p.map);
    // 地圖建立時欄寬可能還沒排定，先讓 MapLibre 重新量一次容器大小
    for (const m of maps) m.resize();
    const pad = s.county ? { top: 24, right: 24, bottom: 24, left: 24 } : { top: 24, right: 24, bottom: 80, left: 44 };
    return easeAllTo(maps, targetBounds(s), pad, instant);
  }

  async function apply() {
    if (status.value !== 'ready') return;
    const s = state.value;
    const fixed = validate(s, validateCtx(store.hasVillages()));
    if (JSON.stringify(fixed) !== JSON.stringify(s)) {
      replace(fixed);
      return;
    }
    if (s.county) {
      await store.ensureTowns();
      version.value++;
    }
    if (s.town && !store.hasVillages()) {
      villageStatus.value = 'loading';
      paint();
      try {
        if ((await villagesLatest(store.ensureVillages())) === STALE) return;
      } catch {
        villageStatus.value = 'error';
        return;
      }
      villageStatus.value = 'idle';
      version.value++;
      const again = validate(state.value, validateCtx(true));
      if (JSON.stringify(again) !== JSON.stringify(state.value)) {
        replace(again);
        return;
      }
    }
    paint();
    const key = `${state.value.county}|${state.value.town}`;
    if (key !== lastTarget && frame(lastTarget === null)) lastTarget = key;
  }

  // ── 互動 ──────────────────────────────────────────────

  function tooltipLines(year: number, hit: PaneHit): string[] {
    const level = hit.source === 'counties' ? 'county' : hit.source === 'towns' ? 'town' : 'village';
    const row = store.rowByCode(year, level, hit.code);
    const props = hit.props;
    const name = row?.name ?? stripBrackets(props.VILLNAME || props.TOWNNAME || props.COUNTYNAME);
    const title = level === 'county' ? name : `${props.COUNTYNAME} · ${name}`;
    if (!store.meta.hasResults(year)) {
      const n = store.meta.contest(year, props.COUNTYNAME)?.candidates.length ?? 0;
      return [title, `${year} · ${n} 位參選人 · 尚未開票`];
    }
    if (!row) return [title, '本屆無資料'];
    const [, , pct] = row.votes[0];
    const lines = [title, `${year} · ${store.meta.candidate(row.winner).name}（${store.meta.partyOfCandidate(row.winner).label}）${pct2(pct)}`];
    const layer = state.value.layer;
    if (layer === 'turnout') lines.push(`投票率 ${pct2(row.turnout)}`);
    else lines.push(`差距 ${pp2(row.margin_pp)} · ${int(row.margin_votes)} 票`);
    if (layer === 'flip') {
      const p = prevYear(year);
      let f: boolean | null = null;
      if (level === 'county') f = row.flipped ?? null;
      else if (p !== null && level === 'town') f = flipBetween(row, store.townRow(p, toBaseArea(hit.code)), store.meta);
      else if (p !== null && state.value.town) {
        f = flipBetween(row, store.villageRow(p, store.villageIdOf(year, hit.code), state.value.town), store.meta);
      }
      lines.push(f === null ? '無前屆比較' : f ? '政黨輪替' : '延續執政');
    }
    return lines;
  }

  function onPaneClick(year: number, hit: PaneHit) {
    if (hit.source === 'counties') set({ county: toBaseArea(hit.code), town: null, village: null });
    else if (hit.source === 'towns') set({ town: toBaseArea(hit.code), village: null });
    else set({ village: store.villageIdOf(year, hit.code) });
  }

  function showTip(year: number, hit: PaneHit | null, ev: MouseEvent) {
    tooltip.value = hit && status.value === 'ready' ? { x: ev.clientX, y: ev.clientY, lines: tooltipLines(year, hit) } : null;
  }

  function registerPane(year: number, pane: PaneHandle) {
    panes.set(year, pane);
    // 開發模式除錯用：在主控台以 __panes 取得各格地圖
    if (import.meta.env.DEV) (window as unknown as { __panes: typeof panes }).__panes = panes;
    pane.onHover((hit, ev) => {
      pane.setHover(hit);
      showTip(year, hit, ev);
    });
    pane.onClick((hit) => onPaneClick(year, hit));
    // 面板在 meta 載入後才建立，所以年份數已知
    if (panes.size === store.meta.years().length) {
      unsync?.();
      unsync = syncCameras([...panes.values()].map((p) => p.map));
    }
    void apply();
  }

  function zoom(dir: 1 | -1) {
    zoomAll([...panes.values()].map((p) => p.map), dir);
  }

  let resizeQueued = false;
  /** 同一個畫格內多格同時改變大小時只處理一次 */
  function resized() {
    if (resizeQueued) return;
    resizeQueued = true;
    requestAnimationFrame(() => {
      resizeQueued = false;
      if (status.value === 'ready' && frame(true)) lastTarget = `${state.value.county}|${state.value.town}`;
    });
  }

  function retryVillages() {
    void apply();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') set(up(state.value));
  };

  onMounted(async () => {
    window.addEventListener('keydown', onKey);
    try {
      await store.init();
    } catch {
      status.value = 'error';
      return;
    }
    status.value = 'ready';
    version.value++;
    await apply();
  });
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKey);
    unsync?.();
  });
  watch(state, () => {
    tooltip.value = null; // 換層級後原本 hover 的區塊可能已不在原處
    void apply();
  });

  return {
    store, status, villageStatus, version, state: state as Readonly<Ref<ViewState>>, set, tooltip,
    registerPane, onPaneClick, showTip, zoom, resized, retryVillages, rowAt, flipAt, prevYear, countyFill,
    countyName, townName, villageName,
  };
}

export type CompareCtx = ReturnType<typeof useCompare>;
/** 側欄元件以 inject 取得 */
export const CompareKey: InjectionKey<CompareCtx> = Symbol('compare');
