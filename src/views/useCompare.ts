// 四屆比較：把 ElectionStore、URL 狀態與四格地圖串起來。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type Ref } from 'vue';
import type { Feature } from 'geojson';
import { ElectionStore } from '../data/store';
import { createJsonCache, latest } from '../data/cache';
import { toBaseArea } from '../data/crossYear';
import type { Layer } from '../data/types';
import { mainBounds } from '../geo/topo';
import { OUTER_COUNTIES, type PaneHandle, type PaneHit } from '../map/pane';
import { cameraOf, easeAllTo, syncCameras, zoomAll } from '../map/sync';
import type { FitPadding } from '../map/gisZoom';
import { useMobile } from '../state/useMobile';
import { useViewState } from '../state/useViewState';
import { up, validate, type ViewState } from '../state/url';
import { runApply, type LoadStatus } from './flow';
import { createLookups, fillOf, tooltipLines, type ViewCtx } from './common';
import { effectiveYear, yearPatch } from './gisSelect';

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
  // 手機版：只建立一張地圖，顯示目前屆次（與 GIS 共用網址的 year）；桌機四張
  const mobile = useMobile();
  const expected = () => (mobile.value ? 1 : store.meta.years().length);
  /** 手機版由畫面提供對準時的 padding（扣掉頂部控制列、摘要列與抽屜） */
  let padding: (() => FitPadding) | null = null;
  const currentYear = computed<number | null>(() => (mobile.value && status.value === 'ready' ? effectiveYear(state.value, store.meta) : null));

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

  /** 地圖都建立後才移動（桌機四張、手機一張）；回傳是否真的移動了 */
  function frame(instant: boolean): boolean {
    const s = state.value;
    if (panes.size < expected()) return false;
    const maps = [...panes.values()].map((p) => p.map);
    // 地圖建立時欄寬可能還沒排定，先讓 MapLibre 重新量一次容器大小
    for (const m of maps) m.resize();
    const pad = padding?.() ?? (s.county ? { top: 24, right: 24, bottom: 24, left: 24 } : { top: 24, right: 24, bottom: 80, left: 44 });
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
    // 手機沒有滑鼠移入：點一下後瀏覽器補發的 mousemove 不能出現 tooltip
    tooltip.value = hit && status.value === 'ready' && !mobile.value ? { x: ev.clientX, y: ev.clientY, lines: tooltipLines(store, year, hit, state.value.layer) } : null;
  }

  function registerPane(year: number, pane: PaneHandle) {
    panes.set(year, pane);
    // 開發模式除錯用：在主控台以 __panes 取得各格地圖
    if (import.meta.env.DEV) (window as unknown as { __panes: typeof panes }).__panes = panes;
    pane.onHover((hit, ev) => {
      pane.setHover(mobile.value ? null : hit);
      showTip(year, hit, ev);
    });
    // 手機的唯一一張地圖換屆後鍵會變，點選要用當下的屆次
    pane.onClick((hit) => onPaneClick(mobile.value ? currentYear.value ?? year : year, hit));
    // 面板在 meta 載入後才建立，所以年份數已知
    if (!mobile.value && panes.size === store.meta.years().length) {
      unsync?.();
      unsync = syncCameras([...panes.values()].map((p) => cameraOf(p.map)));
    }
    void apply();
  }

  /** 手機換屆：唯一一張地圖改掛到新屆次，換圖資與著色，視角不動 */
  function rekey(year: number) {
    // 剛跨過門檻時 panes 還是桌機那四張（即將卸載），不能拿來畫
    if (panes.size !== 1) return;
    const [entry] = panes;
    if (entry[0] === year) return;
    panes.clear();
    based.clear();
    panes.set(year, entry[1]);
    paint();
  }

  function setYear(y: number) {
    set(yearPatch(y, store.meta));
  }

  function setPadding(fn: (() => FitPadding) | null) {
    padding = fn;
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
  watch(currentYear, (y) => {
    if (mobile.value && y !== null) rekey(y);
  });
  // 跨過手機門檻：舊地圖即將卸載、新地圖即將掛上，先清掉登記（pre flush 在重新繪製前執行）
  watch(mobile, () => {
    unsync?.();
    unsync = null;
    panes.clear();
    based.clear();
    lastTarget = null;
    tooltip.value = null;
  });

  const ctx = {
    store, status, load, version, state: state as Readonly<Ref<ViewState>>, set, tooltip,
    registerPane, onPaneClick, showTip, zoom, resized, retry, rowAt, flipAt, prevYear, countyFill,
    countyName, townName, villageName, currentYear, setYear, setPadding,
  };
  return ctx satisfies ViewCtx;
}
