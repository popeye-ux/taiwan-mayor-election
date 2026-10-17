import { describe, it, expect } from 'vitest';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { labelPoint, labelName, labelPoints } from '../src/geo/labels';
import { levelAtZoom, ZOOM_TOWN, ZOOM_VILLAGE } from '../src/map/gisZoom';
import { row } from './fixtures/store';

// 小範圍經緯度（臺灣附近），方向用逆時針外環
const ring = (x: number, y: number, s: number) => [[x, y], [x + s, y], [x + s, y + s], [x, y + s], [x, y]];
const square = (x: number, y: number, s: number): Feature<Polygon> =>
  ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring(x, y, s)] } });
const multi = (parts: Feature<Polygon>[]): Feature<MultiPolygon> =>
  ({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: parts.map((p) => p.geometry.coordinates) } });
// C 形：質心落在缺口（形狀外）
const cShape: Feature<Polygon> = {
  type: 'Feature', properties: {},
  geometry: { type: 'Polygon', coordinates: [[
    [121, 23], [121.3, 23], [121.3, 23.05], [121.05, 23.05], [121.05, 23.25], [121.3, 23.25], [121.3, 23.3], [121, 23.3], [121, 23],
  ]] },
};

/** 平面射線法，不受繞行方向影響 */
function inside([x, y]: [number, number], ring: number[][]): boolean {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

describe('labelPoint', () => {
  it('square → center', () => {
    const [x, y] = labelPoint(square(121, 23, 0.2))!;
    expect(x).toBeCloseTo(121.1, 3);
    expect(y).toBeCloseTo(23.1, 3);
  });
  it('C-shape → point inside', () => {
    expect(inside(labelPoint(cShape)!, cShape.geometry.coordinates[0])).toBe(true);
  });
  it('multipolygon → largest part', () => {
    const p = labelPoint(multi([square(121, 23, 0.04), square(120, 22, 0.4)]))!;
    expect(p[0]).toBeLessThan(120.4);
  });
  it('no geometry → null', () => {
    expect(labelPoint({ geometry: null as unknown as Polygon })).toBeNull();
  });
});

describe('labelName', () => {
  it('strips brackets', () => expect(labelName('瓦[磘]村', undefined)).toBe('瓦磘村'));
  it('hides wildcard without a result row', () => expect(labelName('糖\uFFFD里', undefined)).toBe(''));
  it('prefers result row name', () => expect(labelName('糖\uFFFD里', row(1, '糖廍里', 'X', 'Y', []))).toBe('糖廍里'));
});

describe('labelPoints', () => {
  it('builds points, skipping empty names', () => {
    const feats = [
      { ...square(121, 23, 0.2), properties: { CODE: 'a', NAME: '甲' } },
      { ...square(121.5, 23, 0.2), properties: { CODE: 'b', NAME: '' } },
    ];
    const fc = labelPoints(feats, (p) => p.CODE, (p) => p.NAME);
    expect(fc.features.map((f) => f.properties)).toEqual([{ code: 'a', name: '甲' }]);
    expect(fc.features[0].geometry.type).toBe('Point');
  });
});

it('levelAtZoom', () => {
  expect([ZOOM_TOWN, ZOOM_VILLAGE]).toEqual([8.5, 12]);
  expect(levelAtZoom(8.49)).toBe('county');
  expect(levelAtZoom(8.5)).toBe('town');
  expect(levelAtZoom(11.99)).toBe('town');
  expect(levelAtZoom(12)).toBe('village');
});
