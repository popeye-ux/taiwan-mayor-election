// GIS 的全螢幕地圖：一屆、三層依縮放分級（design.md 第六節），feature-state 換色、hover 與選取，另有三層地名標籤。
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { BaseGeo } from '../geo/topo';
import { NONE } from '../domain/fill';
import type { PaneHit, SourceId } from './pane';
import { FIT, INITIAL, MAX_ZOOM, MIN_ZOOM, ZOOM_TOWN, ZOOM_VILLAGE, levelAtZoom, type ZoomLevel } from './gisZoom';

export interface LabelSet { counties: FeatureCollection; towns: FeatureCollection }

export interface GisMapHandle {
  map: maplibregl.Map;
  ready: Promise<void>;
  setBase(geo: BaseGeo, labels: LabelSet): void;
  /** null：村里圖資尚未載入，鄉鎮層延伸到最大縮放 */
  setVillages(fc: FeatureCollection | null, labels: FeatureCollection | null): void;
  setFills(source: SourceId, fills: Map<string, string>): void;
  setPreview(on: boolean): void;
  setHover(hit: PaneHit | null): void;
  setSelected(source: SourceId | null, codes: string[]): void;
  /** instant：開站時依網址定位，不播動畫 */
  fitTo(bounds: [[number, number], [number, number]], level: ZoomLevel, instant?: boolean): void;
  home(): void;
  onHover(cb: (hit: PaneHit | null, ev: MouseEvent) => void): void;
  onClick(cb: (hit: PaneHit) => void): void;
  /** 雙擊陸地以外（海面）。陸地以畫面上任一層填色判斷，沒有村名的小島也算陸地 */
  onDblClickOutside(cb: () => void): void;
  onZoom(cb: (level: ZoomLevel) => void): void;
  destroy(): void;
}

const SOURCES: SourceId[] = ['counties', 'towns', 'villages'];
const KEY: Record<SourceId, string> = { counties: 'COUNTYCODE', towns: 'TOWNCODE', villages: 'VILLCODE' };
const LEVEL_SOURCE: Record<ZoomLevel, SourceId> = { county: 'counties', town: 'towns', village: 'villages' };
const PAPER = '#F6F7FB';
const LINE = '#FFFFFF';
const PREVIEW_LINE = '#C3C7D6';
const OUTLINE_FAR = '#C3C7D6';
const HOVER = '#1A1A1A';
const SELECTED = '#FF7A1A';
const LABEL = '#16161D';
const LABEL_VILLAGE = '#5B6075';
const FONT = ['Klokantech Noto Sans Regular'];
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const FILL_EXPR: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'fill'], NONE];
const BORROWED: maplibregl.FilterSpecification = ['has', 'BORROWED'];
const NOT_BORROWED: maplibregl.FilterSpecification = ['!', ['has', 'BORROWED']];

const hoverOr = (on: number, off: number): maplibregl.ExpressionSpecification =>
  ['case', ['boolean', ['feature-state', 'hover'], false], on, off];
const flag = (name: string, on: number): maplibregl.ExpressionSpecification =>
  ['case', ['boolean', ['feature-state', name], false], on, 0];

/** 各層填色的縮放範圍與不透明度 */
const FILL: Record<SourceId, { min: number; max: number; opacity: number; hover: number }> = {
  counties: { min: 0, max: ZOOM_TOWN, opacity: 0.82, hover: 0.94 },
  towns: { min: ZOOM_TOWN, max: ZOOM_VILLAGE, opacity: 0.62, hover: 0.74 },
  villages: { min: ZOOM_VILLAGE, max: 24, opacity: 0.70, hover: 0.85 },
};

export function createGisMap(container: HTMLElement): GisMapHandle {
  const map = new maplibregl.Map({
    container,
    style: {
      version: 8,
      // 英數字形放在本站（只有 0–255）；中文由瀏覽器以 localIdeographFontFamily 繪製
      glyphs: `${location.origin}${import.meta.env.BASE_URL}fonts/{fontstack}/{range}.pbf`,
      sources: {},
      layers: [{ id: 'bg', type: 'background', paint: { 'background-color': PAPER } }],
    },
    localIdeographFontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
    center: INITIAL.center,
    zoom: INITIAL.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    dragRotate: false,
    pitchWithRotate: false,
    doubleClickZoom: false,
    attributionControl: false,
    renderWorldCopies: false,
  });
  map.touchZoomRotate.disableRotation();
  // 下方角落後加入的控制項排在上面：比例尺先加，才會在縮放按鈕下方
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');

  const filled = new Map<SourceId, Set<string>>(SOURCES.map((s) => [s, new Set()]));
  let selected: { source: SourceId; code: string }[] = [];
  let hovered: PaneHit | null = null;
  let hasVillages = false;

  const ready = new Promise<void>((resolve) => {
    map.once('load', () => {
      for (const s of SOURCES) {
        map.addSource(s, { type: 'geojson', data: EMPTY, promoteId: KEY[s] });
        map.addSource(`${s}-label`, { type: 'geojson', data: EMPTY });
      }
      for (const s of SOURCES) {
        map.addLayer({
          id: `${s}-fill`, type: 'fill', source: s, minzoom: FILL[s].min, maxzoom: FILL[s].max,
          ...(s === 'villages' ? { filter: NOT_BORROWED } : {}),
          paint: { 'fill-color': FILL_EXPR, 'fill-opacity': hoverOr(FILL[s].hover, FILL[s].opacity) },
        });
      }
      map.addLayer({ id: 'towns-line', type: 'line', source: 'towns', minzoom: ZOOM_TOWN, paint: { 'line-color': LINE, 'line-width': 0.6 } });
      const villageLine = (id: string, filter: maplibregl.FilterSpecification) => map.addLayer({
        id, type: 'line', source: 'villages', minzoom: 11, filter,
        paint: {
          'line-color': LINE,
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 12, 1],
          'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.3, 15, 1.2],
        },
      });
      villageLine('villages-line', NOT_BORROWED);
      // 借來的形狀（2014）和原有的村重疊：畫在原有村里的填色與邊界之上，先鋪不透明底色蓋住下面的村
      // （顏色與舊界線都不透出來），再半透明著色、畫自己的邊界
      const v = FILL.villages;
      map.addLayer({
        id: 'villages-mask', type: 'fill', source: 'villages', minzoom: v.min, maxzoom: v.max, filter: BORROWED,
        paint: { 'fill-color': PAPER, 'fill-opacity': 1 },
      });
      map.addLayer({
        id: 'villages-borrowed-fill', type: 'fill', source: 'villages', minzoom: v.min, maxzoom: v.max, filter: BORROWED,
        paint: { 'fill-color': FILL_EXPR, 'fill-opacity': hoverOr(v.hover, v.opacity) },
      });
      villageLine('villages-borrowed-line', BORROWED);
      map.addLayer({ id: 'counties-line', type: 'line', source: 'counties', maxzoom: ZOOM_TOWN, paint: { 'line-color': LINE, 'line-width': 0.8 } });
      // 縣市外框置頂
      map.addLayer({
        id: 'counties-outline', type: 'line', source: 'counties',
        paint: {
          'line-color': ['step', ['zoom'], LINE, 9, OUTLINE_FAR],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2],
        },
      });
      for (const s of SOURCES) {
        map.addLayer({ id: `${s}-hover`, type: 'line', source: s, minzoom: FILL[s].min, maxzoom: FILL[s].max, paint: { 'line-color': HOVER, 'line-width': flag('hover', 1.4) } });
      }
      for (const s of SOURCES) {
        map.addLayer({ id: `${s}-sel`, type: 'line', source: s, paint: { 'line-color': SELECTED, 'line-width': flag('selected', 2) } });
      }
      const label = (s: SourceId, min: number, max: number, size: number, color: string) => map.addLayer({
        id: `${s}-label`, type: 'symbol', source: `${s}-label`, minzoom: min, maxzoom: max,
        layout: { 'text-field': ['get', 'name'], 'text-font': FONT, 'text-size': size, 'text-padding': 2 },
        paint: { 'text-color': color, 'text-halo-color': '#FFFFFF', 'text-halo-width': 1.2 },
      });
      label('counties', 6.5, ZOOM_TOWN, 12, LABEL);
      label('towns', ZOOM_TOWN, ZOOM_VILLAGE, 11, LABEL);
      label('villages', 13, 24, 11, LABEL_VILLAGE);
      applyVillageRange();
      resolve();
    });
  });

  /** 村里圖資還沒到時，鄉鎮填色延伸到最大縮放 */
  function applyVillageRange() {
    if (!map.getLayer('towns-fill')) return;
    const max = hasVillages ? ZOOM_VILLAGE : 24;
    map.setLayerZoomRange('towns-fill', ZOOM_TOWN, max);
    map.setLayerZoomRange('towns-hover', ZOOM_TOWN, max);
  }

  function hitAt(point: maplibregl.PointLike): PaneHit | null {
    let level = levelAtZoom(map.getZoom());
    if (level === 'village' && !hasVillages) level = 'town';
    const source = LEVEL_SOURCE[level];
    const layers = source === 'villages' ? ['villages-borrowed-fill', 'villages-fill'] : [`${source}-fill`];
    for (const f of map.queryRenderedFeatures(point, { layers })) {
      const props = f.properties as Record<string, string>;
      if (source === 'villages' && !props.VILLNAME) continue; // 沒有村名的小島、海域
      return { source, code: props[KEY[source]], props };
    }
    return null;
  }

  const setData = (id: string, fc: FeatureCollection) => (map.getSource(id) as maplibregl.GeoJSONSource).setData(fc);

  let zoomLevel = levelAtZoom(map.getZoom());

  return {
    map,
    ready,
    setBase(geo, labels) {
      void ready.then(() => {
        setData('counties', geo.counties);
        setData('towns', geo.towns);
        setData('counties-label', labels.counties);
        setData('towns-label', labels.towns);
      });
    },
    setVillages(fc, labels) {
      void ready.then(() => {
        hasVillages = !!fc;
        setData('villages', fc ?? EMPTY);
        setData('villages-label', labels ?? EMPTY);
        applyVillageRange();
      });
    },
    setFills(source, fills) {
      void ready.then(() => {
        const prev = filled.get(source)!;
        for (const code of prev) if (!fills.has(code)) map.removeFeatureState({ source, id: code }, 'fill');
        for (const [code, color] of fills) map.setFeatureState({ source, id: code }, { fill: color });
        filled.set(source, new Set(fills.keys()));
      });
    },
    setPreview(on) {
      void ready.then(() => {
        for (const id of ['counties-line', 'towns-line', 'villages-line', 'villages-borrowed-line']) map.setPaintProperty(id, 'line-color', on ? PREVIEW_LINE : LINE);
      });
    },
    setHover(hit) {
      void ready.then(() => {
        if (hovered) map.setFeatureState({ source: hovered.source, id: hovered.code }, { hover: false });
        hovered = hit;
        if (hit) map.setFeatureState({ source: hit.source, id: hit.code }, { hover: true });
      });
    },
    setSelected(source, codes) {
      void ready.then(() => {
        for (const s of selected) map.setFeatureState({ source: s.source, id: s.code }, { selected: false });
        selected = source ? codes.map((code) => ({ source, code })) : [];
        for (const s of selected) map.setFeatureState({ source: s.source, id: s.code }, { selected: true });
      });
    },
    fitTo(bounds, level, instant = false) {
      const p = FIT[level];
      const cam = map.cameraForBounds(bounds, { padding: p.padding, maxZoom: p.maxZoom });
      if (!cam) return;
      const zoom = Math.max(cam.zoom ?? INITIAL.zoom, p.minZoom ?? 0);
      map.stop();
      map.easeTo({ center: cam.center, zoom, duration: instant ? 0 : p.duration });
    },
    home() {
      map.stop();
      map.flyTo({ ...INITIAL, duration: 900 });
    },
    onHover(cb) {
      map.on('mousemove', (e) => {
        const hit = hitAt(e.point);
        map.getCanvas().style.cursor = hit ? 'pointer' : '';
        cb(hit, e.originalEvent);
      });
      map.getCanvas().addEventListener('mouseleave', (ev) => cb(null, ev));
    },
    onClick(cb) {
      map.on('click', (e) => {
        const hit = hitAt(e.point);
        if (hit) cb(hit);
      });
    },
    onDblClickOutside(cb) {
      const layers = [...SOURCES.map((s) => `${s}-fill`), 'villages-borrowed-fill'];
      map.on('dblclick', (e) => {
        if (!map.queryRenderedFeatures(e.point, { layers }).length) cb();
      });
    },
    onZoom(cb) {
      map.on('zoom', () => {
        const lv = levelAtZoom(map.getZoom());
        if (lv !== zoomLevel) {
          zoomLevel = lv;
          cb(lv);
        }
      });
    },
    destroy() {
      map.remove();
    },
  };
}
