// 一格 MapLibre 地圖：三個 GeoJSON source（縣市、鄉鎮、村里），用 feature-state 換色、hover 與選取。
import maplibregl from 'maplibre-gl';
import type { FeatureCollection } from 'geojson';
import type { BaseGeo } from '../geo/topo';
import { NONE } from '../domain/fill';

export type SourceId = 'counties' | 'towns' | 'villages';
export interface PaneHit { source: SourceId; code: string; props: Record<string, string> }
export interface PaneMode { level: 'national' | 'county' | 'town'; countyCode: string | null; preview: boolean }

export interface PaneHandle {
  map: maplibregl.Map;
  ready: Promise<void>;
  setBase(geo: BaseGeo): void;
  setVillages(fc: FeatureCollection | null): void;
  setFills(source: SourceId, fills: Map<string, string>): void;
  setMode(mode: PaneMode): void;
  setHover(hit: PaneHit | null): void;
  setSelected(source: SourceId, codes: string[]): void;
  onHover(cb: (hit: PaneHit | null, ev: MouseEvent) => void): void;
  onClick(cb: (hit: PaneHit) => void): void;
  destroy(): void;
}

const SOURCES: SourceId[] = ['counties', 'towns', 'villages'];
const KEY: Record<SourceId, string> = { counties: 'COUNTYCODE', towns: 'TOWNCODE', villages: 'VILLCODE' };
/** 全國視圖改放插圖框的連江、金門 */
export const OUTER_COUNTIES = ['09007', '09020'];
const LAND = '#F2F3F8';
const LINE = '#FFFFFF';
const PREVIEW_LINE = '#C3C7D6';
const HOVER = '#16161D';
const SELECTED = '#FF7A1A';
const EMPTY: FeatureCollection = { type: 'FeatureCollection', features: [] };
const FILL_EXPR: maplibregl.ExpressionSpecification = ['coalesce', ['feature-state', 'fill'], NONE];

const stateFlag = (name: string, on: number): maplibregl.ExpressionSpecification =>
  ['case', ['boolean', ['feature-state', name], false], on, 0];

export function createPane(container: HTMLElement): PaneHandle {
  const map = new maplibregl.Map({
    container,
    style: { version: 8, sources: {}, layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#F6F7FB' } }] },
    center: [120.9, 23.7],
    zoom: 6,
    minZoom: 4,
    maxZoom: 16,
    dragRotate: false,
    pitchWithRotate: false,
    doubleClickZoom: false,
    keyboard: false,
    attributionControl: false,
    renderWorldCopies: false,
  });
  map.touchZoomRotate.disableRotation();

  const filled = new Map<SourceId, Set<string>>(SOURCES.map((s) => [s, new Set()]));
  let selected: { source: SourceId; code: string }[] = [];
  let hovered: PaneHit | null = null;
  let mode: PaneMode = { level: 'national', countyCode: null, preview: false };

  const ready = new Promise<void>((resolve) => {
    map.once('load', () => {
      for (const s of SOURCES) map.addSource(s, { type: 'geojson', data: EMPTY, promoteId: KEY[s] });
      for (const s of SOURCES) map.addLayer({ id: `${s}-fill`, type: 'fill', source: s, paint: { 'fill-color': FILL_EXPR } });
      for (const s of SOURCES) {
        map.addLayer({ id: `${s}-line`, type: 'line', source: s, paint: { 'line-color': LINE, 'line-width': s === 'villages' ? 0.5 : 0.8 } });
      }
      for (const s of SOURCES) {
        map.addLayer({ id: `${s}-hover`, type: 'line', source: s, paint: { 'line-color': HOVER, 'line-width': stateFlag('hover', 1.4) } });
      }
      for (const s of SOURCES) {
        map.addLayer({ id: `${s}-sel`, type: 'line', source: s, paint: { 'line-color': SELECTED, 'line-width': stateFlag('selected', 2) } });
      }
      applyMode();
      resolve();
    });
  });

  function visible(s: SourceId): boolean {
    if (s === 'counties') return true;
    if (s === 'towns') return mode.level !== 'national';
    return mode.level === 'town';
  }

  function applyMode() {
    if (!map.getLayer('counties-fill')) return;
    const national = mode.level === 'national';
    const countyFilter: maplibregl.FilterSpecification = national
      ? ['!', ['in', ['get', 'COUNTYCODE'], ['literal', OUTER_COUNTIES]]]
      : ['!=', ['get', 'COUNTYCODE'], mode.countyCode ?? ''];
    const townFilter: maplibregl.FilterSpecification = ['==', ['get', 'COUNTYCODE'], mode.countyCode ?? ''];
    for (const s of SOURCES) {
      const vis = visible(s) ? 'visible' : 'none';
      for (const suffix of ['fill', 'line', 'hover', 'sel']) {
        const id = `${s}-${suffix}`;
        map.setLayoutProperty(id, 'visibility', vis);
        if (s === 'counties') map.setFilter(id, countyFilter);
        if (s === 'towns') map.setFilter(id, townFilter);
      }
      map.setPaintProperty(`${s}-line`, 'line-color', mode.preview ? PREVIEW_LINE : LINE);
    }
    // 縣市層以下，其他縣市只當背景
    map.setPaintProperty('counties-fill', 'fill-color', national ? FILL_EXPR : LAND);
  }

  function hitAt(point: maplibregl.PointLike): PaneHit | null {
    const layers = SOURCES.filter(visible).map((s) => `${s}-fill`).reverse();
    for (const f of map.queryRenderedFeatures(point, { layers })) {
      const source = f.source as SourceId;
      const props = f.properties as Record<string, string>;
      if (source === 'villages' && !props.VILLNAME) continue; // 沒有村名的小島、海域
      return { source, code: props[KEY[source]], props };
    }
    return null;
  }

  const handle: PaneHandle = {
    map,
    ready,
    setBase(geo) {
      void ready.then(() => {
        (map.getSource('counties') as maplibregl.GeoJSONSource).setData(geo.counties);
        (map.getSource('towns') as maplibregl.GeoJSONSource).setData(geo.towns);
      });
    },
    setVillages(fc) {
      void ready.then(() => (map.getSource('villages') as maplibregl.GeoJSONSource).setData(fc ?? EMPTY));
    },
    setFills(source, fills) {
      void ready.then(() => {
        const prev = filled.get(source)!;
        for (const code of prev) if (!fills.has(code)) map.removeFeatureState({ source, id: code }, 'fill');
        for (const [code, color] of fills) map.setFeatureState({ source, id: code }, { fill: color });
        filled.set(source, new Set(fills.keys()));
      });
    },
    setMode(m) {
      mode = m;
      void ready.then(applyMode);
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
        selected = codes.map((code) => ({ source, code }));
        for (const s of selected) map.setFeatureState({ source, id: s.code }, { selected: true });
      });
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
    destroy() {
      map.remove();
    },
  };
  return handle;
}
