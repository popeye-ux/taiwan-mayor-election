// 地名標籤：每個區域一個點（在形狀內部；多島區域標最大的一塊）。座標直接當平面算，只用在臺灣附近的小範圍。
import type { Feature, FeatureCollection, Geometry, Point, Position } from 'geojson';
import type { ResultRow } from '../data/types';
import { ringArea } from './topo';

const WILDCARD = '�';

/** 面積最大的一塊多邊形（外環＋內環） */
function largestPolygon(g: Geometry | null): Position[][] | null {
  if (!g) return null;
  if (g.type === 'Polygon') return g.coordinates;
  if (g.type !== 'MultiPolygon' || !g.coordinates.length) return null;
  let best = g.coordinates[0];
  let max = -1;
  for (const p of g.coordinates) {
    const a = ringArea(p[0]);
    if (a > max) [best, max] = [p, a];
  }
  return best;
}

/** 外環的平面質心 */
function ringCentroid(ring: Position[]): [number, number] {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  if (a === 0) return [ring[0][0], ring[0][1]];
  return [cx / (3 * a), cy / (3 * a)];
}

/** 水平線 y 與各環的交點 x（排序後兩兩成對就是形狀內部的線段） */
function crossings(rings: Position[][], y: number): number[] {
  const xs: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y)) xs.push(xi + ((y - yi) * (xj - xi)) / (yj - yi));
    }
  }
  return xs.sort((a, b) => a - b);
}

function inside([x, y]: [number, number], rings: Position[][]): boolean {
  return crossings(rings, y).filter((cx) => cx < x).length % 2 === 1;
}

/** 標籤點：最大一塊的質心；質心不在形狀內（例如 C 形）時，改用通過質心緯度最長一段內部線段的中點 */
export function labelPoint(f: Pick<Feature, 'geometry'>): [number, number] | null {
  const poly = largestPolygon(f.geometry);
  if (!poly || !poly[0]?.length) return null;
  const c = ringCentroid(poly[0]);
  if (inside(c, poly)) return c;
  const xs = crossings(poly, c[1]);
  let best: [number, number] | null = null;
  let len = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > len) {
      len = xs[i + 1] - xs[i];
      best = [(xs[i] + xs[i + 1]) / 2, c[1]];
    }
  }
  return best ?? [poly[0][0][0], poly[0][0][1]];
}

/** 標籤文字：有開票結果用結果的名稱；否則用圖資名稱（去方括號），仍有不確定字（U+FFFD）時不標 */
export function labelName(geoName: string, row: ResultRow | undefined): string {
  if (row) return row.name;
  const name = geoName.replace(/[[\]]/g, '');
  return name.includes(WILDCARD) ? '' : name;
}

export function labelPoints<P>(
  features: Feature<Geometry, P>[],
  codeOf: (p: P) => string,
  nameOf: (p: P, code: string) => string,
): FeatureCollection<Point, { code: string; name: string }> {
  const out: Feature<Point, { code: string; name: string }>[] = [];
  for (const f of features) {
    const code = codeOf(f.properties);
    const name = nameOf(f.properties, code);
    if (!name) continue;
    const p = labelPoint(f);
    if (p) out.push({ type: 'Feature', properties: { code, name }, geometry: { type: 'Point', coordinates: p } });
  }
  return { type: 'FeatureCollection', features: out };
}
