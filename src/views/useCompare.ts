// 四屆比較：把 ElectionStore、URL 狀態與四格地圖串起來。
import { onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { Feature } from 'geojson';
import { ElectionStore } from '../data/store';
import { createJsonCache, latest } from '../data/cache';
import { toBaseArea } from '../data/crossYear';
import type { Layer } from '../data/types';
import { mainBounds } from '../geo/topo';
import { OUTER_COUNTIES, type PaneHandle, type PaneHit } from '../map/pane';
import { cameraOf, easeAllTo, syncCameras, zoomAll } from '../map/sync';
import { useViewState } from '../state/useViewState';
import { up, validate, type ViewState } from '../state/url';
import { runApply, type LoadStatus } from './flow';
import { createLookups, fillOf, tooltipLines, type ViewCtx } from './common';

export type ViewLevel = 'national' | 'county' | 'town';

export const levelOf = (s: ViewState): ViewLevel => (s.town ? 'town' : s.county ? 'county' : 'national');

export function useCompare() {
  const store = new ElectionStore(createJsonCache());
  const status = ref<'loading' | 'ready' | 'error'>('loading');
  const load = shallowRef<LoadStatus>({ kind: 'idle' });
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

  const lookups = createLookups(store);
  const { prevYear, countyName, townName, villageName } = lookups;
  const baseYear = () => store.meta.baseYear();
  const rowAt = (year: number, s: ViewState = state.value) => lookups.rowAt(year, s);
  const flipAt = (year: number, s: ViewState = state.value) => lookups.flipAt(year, s);

  // ── 填色 ──────────────────────────────────────────────

  /** 某一層的填色；level 決定畫哪個 source（全國→縣市、縣市→鄉鎮、鄉鎮→村里） */
  function fillsFor(year: number, layer: Layer, s: ViewState, level: ViewLevel): { source: 'counties' | 'towns' | 'villages'; fills: Map<string, string> } {
    const fills = new Map<string, string>();
    if (level === 'national') {
      for (const f of store.baseGeo(year).counties.features) {
        fills.set(f.properties.COUNTYCODE, fillOf(store, year, layer, 'county', f.properties.COUNTYCODE));
      }
      return { source: 'counties', fills };
    }
    if (level === 'county') {
      const cc = store.areaCode(year, s.county!);
      for (const f of store.baseGeo(year).towns.features) {
        if (f.properties.COUNTYCODE === cc) fills.set(f.properties.TOWNCODE, fillOf(store, year, layer, 'town', f.properties.TOWNCODE));
      }
      return { source: 'towns', fills };
    }
    for (const f of store.villagesOfTown(year, s.town!).features) {
      if (f.properties.VILLNAME) fills.set(f.properties.VILLCODE, fillOf(store, year, layer, 'village', f.properties.VILLCODE));
    }
    return { source: 'villages', fills };
  }

  /** 插圖框用：全國層某縣市的顏色 */
  function countyFill(year: number, code: string): string {
    return fillOf(store, year, state.value.layer, 'county', code);
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

  function apply(): Promise<void> {
    if (status.value !== 'ready') return Promise.resolve();
    return runApply({
      state: () => state.value,
      validate: (x, withVillages) => validate(x, lookups.validateCtx(withVillages)),
      replace,
      hasVillages: () => store.hasVillages(),
      ensureTowns: () => store.ensureTowns(),
      ensureVillages: () => villagesLatest(store.ensureVillages()),
      paint,
      frame: () => {
        const key = `${state.value.county}|${state.value.town}`;
        if (key !== lastTarget && frame(lastTarget === null)) lastTarget = key;
      },
      setLoad: (l) => { load.value = l; },
      bump: () => { version.value++; },
    });
  }


  // ── 互動 ──────────────────────────────────────────────

  function onPaneClick(year: number, hit: PaneHit) {
    if (hit.source === 'counties') set({ county: toBaseArea(hit.code), town: null, village: null });
    else if (hit.source === 'towns') set({ town: toBaseArea(hit.code), village: null });
    else set({ village: store.villageIdOf(year, hit.code) });
  }

  function showTip(year: number, hit: PaneHit | null, ev: MouseEvent) {
    tooltip.value = hit && status.value === 'ready' ? { x: ev.clientX, y: ev.clientY, lines: tooltipLines(store, year, hit, state.value.layer) } : null;
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
      unsync = syncCameras([...panes.values()].map((p) => cameraOf(p.map)));
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

  function retry() {
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

  const ctx = {
    store, status, load, version, state: state as Readonly<Ref<ViewState>>, set, tooltip,
    registerPane, onPaneClick, showTip, zoom, resized, retry, rowAt, flipAt, prevYear, countyFill,
    countyName, townName, villageName, currentYear: ref<number | null>(null),
  };
  return ctx satisfies ViewCtx;
}
