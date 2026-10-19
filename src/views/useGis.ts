// GIS 圖台：一屆、一張全螢幕地圖，依縮放分級顯示縣市、鄉鎮、村里。把 ElectionStore、URL 狀態與地圖串起來。
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type InjectionKey, type Ref } from 'vue';
import type { Feature } from 'geojson';
import { ElectionStore } from '../data/store';
import { createJsonCache, latest } from '../data/cache';
import { toBaseArea } from '../data/crossYear';
import type { Level } from '../data/types';
import { labelName, labelPoints } from '../geo/labels';
import { mainBounds, townOfVillage } from '../geo/topo';
import type { GisMapHandle } from '../map/gisMap';
import { levelAtZoom, INITIAL, type FitPadding, type ZoomLevel } from '../map/gisZoom';
import { OUTER_COUNTIES, type PaneHit } from '../map/pane';
import { useViewState } from '../state/useViewState';
import { useMobile } from '../state/useMobile';
import { up, validate, type ViewState } from '../state/url';
import { runApply, type LoadStatus } from './flow';
import { createLookups, fillOf, tooltipLines, type ViewCtx } from './common';
import { effectiveYear, selectionOutline, yearPatch } from './gisSelect';

const targetKey = (s: ViewState) => `${s.county}|${s.town}`;

export function useGis() {
  const store = new ElectionStore(createJsonCache());
  const status = ref<'loading' | 'ready' | 'error'>('loading');
  const load = shallowRef<LoadStatus>({ kind: 'idle' });
  const version = ref(0);
  const tooltip = shallowRef<{ x: number; y: number; lines: string[] } | null>(null);
  const zoomLevel = ref<ZoomLevel>(levelAtZoom(INITIAL.zoom));
  const { state, set, replace } = useViewState();
  const villagesLatest = latest<void>();
  const lookups = createLookups(store);
  let gis: GisMapHandle | null = null;
  /** 地圖上目前是哪一屆的形狀與填色（換年份或圖層才重新填色） */
  let shownBase: number | null = null;
  let shownVillages: number | null = null;
  let filledKey = '';
  let lastTarget: string | null = null;
  const mobile = useMobile();
  /** 手機版由畫面提供對準時的 padding（扣掉頂部控制列與抽屜）；桌機用 FIT 預設 */
  let padding: (() => FitPadding) | null = null;

  const currentYear = computed<number | null>(() => (status.value === 'ready' ? effectiveYear(state.value, store.meta) : null));
  const year = () => effectiveYear(state.value, store.meta);

  // ── 地圖 ──────────────────────────────────────────────

  /** 標籤名稱：有開票結果用結果的名稱（村里群組用圖資名稱） */
  function baseLabels(y: number) {
    const g = store.baseGeo(y);
    return {
      counties: labelPoints(g.counties.features, (p) => p.COUNTYCODE, (p, c) => labelName(p.COUNTYNAME, store.rowByCode(y, 'county', c))),
      towns: labelPoints(g.towns.features, (p) => p.TOWNCODE, (p, c) => labelName(p.TOWNNAME, store.rowByCode(y, 'town', c))),
    };
  }

  function villageLabels(y: number) {
    return labelPoints(store.allVillages(y).features, (p) => p.VILLCODE, (p, c) => {
      if (!p.VILLNAME) return '';
      const row = store.rowByCode(y, 'village', c);
      return labelName(p.VILLNAME, row && !row.group ? row : undefined);
    });
  }

  function fills(y: number, level: Level, codes: string[]): Map<string, string> {
    const layer = state.value.layer;
    return new Map(codes.map((c) => [c, fillOf(store, y, layer, level, c)]));
  }

  function paint() {
    if (status.value !== 'ready' || !gis) return;
    const y = year();
    if (shownBase !== y) {
      gis.setBase(store.baseGeo(y), baseLabels(y));
      gis.setPreview(!store.meta.hasResults(y));
      shownBase = y;
      filledKey = '';
    }
    if (store.hasVillages() && shownVillages !== y) {
      gis.setVillages(store.allVillages(y), villageLabels(y));
      shownVillages = y;
      filledKey = '';
    }
    const key = `${y}|${state.value.layer}|${store.hasVillages()}|${version.value}`;
    if (key !== filledKey) {
      const g = store.baseGeo(y);
      gis.setFills('counties', fills(y, 'county', g.counties.features.map((f) => f.properties.COUNTYCODE)));
      gis.setFills('towns', fills(y, 'town', g.towns.features.map((f) => f.properties.TOWNCODE)));
      if (store.hasVillages()) {
        const codes = store.allVillages(y).features.filter((f) => f.properties.VILLNAME).map((f) => f.properties.VILLCODE);
        gis.setFills('villages', fills(y, 'village', codes));
      }
      filledKey = key;
    }
    const o = selectionOutline(store, y, state.value);
    gis.setSelected(o?.source ?? null, o?.codes ?? []);
  }

  /** 選取的縣市或鄉鎮改變時才移動地圖（換年份、圖層不動）；回到全國時回初始視角 */
  function frame() {
    if (!gis) return;
    const s = state.value;
    const key = targetKey(s);
    if (key === lastTarget) return;
    const first = lastTarget === null;
    lastTarget = key;
    const g = store.baseGeo(store.meta.baseYear());
    if (s.town) gis.fitTo(mainBounds(g.towns.features.filter((f) => f.properties.TOWNCODE === s.town)), 'town', first, padding?.());
    else if (s.county) gis.fitTo(mainBounds(g.counties.features.filter((f) => f.properties.COUNTYCODE === s.county)), 'county', first, padding?.());
    else if (!first || padding) goHome(first);
  }

  /** 初始視角。手機版（有 padding）改成把臺灣本島與澎湖對進控制列與抽屜之間的可見範圍 */
  function goHome(instant = false) {
    if (!gis) return;
    if (!padding) {
      gis.home();
      return;
    }
    const feats = store.baseGeo(store.meta.baseYear()).counties.features.filter((f) => !OUTER_COUNTIES.includes(f.properties.COUNTYCODE));
    gis.fitTo(mainBounds(feats), 'county', instant, padding());
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
      frame,
      setLoad: (l) => { load.value = l; },
      bump: () => { version.value++; },
    }).then(() => {
      // 縣市層的章魚清單要用村里資料；放大到村里層也要
      if (state.value.county || zoomLevel.value === 'village') void loadVillages();
    });
  }

  /** 不經過選取（縮放到村里層、縣市層章魚清單）時載入村里資料 */
  async function loadVillages(): Promise<void> {
    if (store.hasVillages() || status.value !== 'ready') return;
    load.value = { kind: 'loading', what: 'villages' };
    try {
      await store.ensureVillages();
    } catch {
      load.value = { kind: 'error', what: 'villages' };
      return;
    }
    load.value = { kind: 'idle' };
    version.value++;
    paint();
  }

  // ── 互動 ──────────────────────────────────────────────

  function onClick(hit: PaneHit) {
    const y = year();
    if (hit.source === 'counties') {
      set({ county: toBaseArea(hit.code), town: null, village: null });
    } else if (hit.source === 'towns') {
      set({ county: toBaseArea(hit.props.COUNTYCODE), town: toBaseArea(hit.code), village: null });
    } else {
      // 點村里只選取、不移動地圖
      const town = toBaseArea(townOfVillage(hit.code));
      const next = { county: town.slice(0, 5), town, village: store.villageIdOf(y, hit.code) };
      lastTarget = targetKey({ ...state.value, ...next });
      set(next);
    }
  }

  /** 側欄清單點選：選取並移動地圖。村里要給所屬鄉鎮（基準代碼） */
  function pick(level: ZoomLevel, id: string, town?: string) {
    if (level === 'county') set({ county: id, town: null, village: null });
    else if (level === 'town') set({ county: id.slice(0, 5), town: id, village: null });
    else if (town) {
      const next = { county: town.slice(0, 5), town, village: id };
      lastTarget = targetKey({ ...state.value, ...next });
      set(next);
      fitVillage(id, town);
    }
  }

  function fitVillage(id: string, town: string) {
    if (!gis || !store.hasVillages()) return;
    for (const y of [year(), store.meta.baseYear()]) {
      const codes = new Set(store.villageCodesIn(y, id, town));
      const feats: Feature[] = store.allVillages(y).features.filter((f) => codes.has(f.properties.VILLCODE));
      if (feats.length) {
        gis.fitTo(mainBounds(feats), 'village', false, padding?.());
        return;
      }
    }
  }

  /** 雙擊臺灣以外：取消選取並回初始視角（年份、圖層不變）。已在全國時也要回初始視角 */
  function reset() {
    lastTarget = targetKey({ ...state.value, county: null, town: null });
    goHome();
    set({ county: null, town: null, village: null });
  }

  function setYear(y: number) {
    set(yearPatch(y, store.meta));
  }

  function registerMap(handle: GisMapHandle) {
    gis = handle;
    if (import.meta.env.DEV) (window as unknown as { __gis: GisMapHandle }).__gis = handle;
    handle.onHover((hit, ev) => {
      // 手機沒有滑鼠移入：點一下後瀏覽器補發的 mousemove 不能畫 hover 或 tooltip
      if (mobile.value) {
        handle.setHover(null);
        tooltip.value = null;
        return;
      }
      handle.setHover(hit);
      tooltip.value = hit && status.value === 'ready'
        ? { x: ev.clientX, y: ev.clientY, lines: tooltipLines(store, year(), hit, state.value.layer) } : null;
    });
    handle.onClick(onClick);
    handle.onDblClickOutside(reset);
    handle.onZoom((lv) => {
      zoomLevel.value = lv;
      if (lv === 'village') void loadVillages();
    });
    void apply();
  }

  function setPadding(fn: (() => FitPadding) | null) {
    padding = fn;
  }

  /** 跨過手機門檻（旋轉手機）後，可見範圍變了：立即重新對準目前選取，全國時回初始視角 */
  function reframe() {
    if (!gis || status.value !== 'ready') return;
    // 容器大小剛變，MapLibre 可能還沒重量畫布；不先量，視角會用舊寬度算
    gis.map.resize();
    lastTarget = null;
    if (state.value.county) frame();
    else goHome(true);
  }

  function retry() {
    void apply();
    if (zoomLevel.value === 'village' || state.value.county) void loadVillages();
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') set(up(state.value));
  };

  onMounted(async () => {
    window.addEventListener('keydown', onKey);
    try {
      await store.init();
      // 全臺鄉鎮在 8.5 級以上都要著色
      await store.ensureTowns();
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
    gis?.destroy();
    gis = null;
  });
  watch(state, () => {
    tooltip.value = null;
    void apply();
  });

  const ctx = {
    store, status, load, version, state: state as Readonly<Ref<ViewState>>, set, retry, tooltip, zoomLevel,
    rowAt: (y: number, s: ViewState = state.value) => lookups.rowAt(y, s),
    flipAt: (y: number, s: ViewState = state.value) => lookups.flipAt(y, s),
    countyName: lookups.countyName, townName: lookups.townName, villageName: lookups.villageName,
    currentYear, registerMap, pick, setYear, setPadding, reframe,
  };
  return ctx satisfies ViewCtx;
}

export type GisCtx = ReturnType<typeof useGis>;
/** GIS 專用元件（年份、側欄點選）以 inject 取得；共用元件用 ViewKey */
export const GisKey: InjectionKey<GisCtx> = Symbol('gis');
