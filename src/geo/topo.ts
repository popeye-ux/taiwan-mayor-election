import { feature } from 'topojson-client';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { GeometryCollection, Topology } from 'topojson-specification';
import type { CountyProps, TownProps, VillProps } from '../data/types';

export interface BaseGeo {
  counties: FeatureCollection<Geometry, CountyProps>;
  towns: FeatureCollection<Geometry, TownProps>;
}

function collection<P>(topo: Topology, name: string): FeatureCollection<Geometry, P> {
  const obj = topo.objects[name] as GeometryCollection;
  if (!obj) throw new Error(`圖資缺少物件 ${name}`);
  const fc = feature(topo, obj) as unknown as FeatureCollection<Geometry | null, P>;
  // 簡化後沒有形狀的小島（type 為 null）不畫
  return { type: 'FeatureCollection', features: fc.features.filter((f) => f.geometry) as Feature<Geometry, P>[] };
}

/** base.json：counties + towns */
export function toBaseGeo(topo: Topology): BaseGeo {
  return { counties: collection<CountyProps>(topo, 'counties'), towns: collection<TownProps>(topo, 'towns') };
}

/** villages.json：villages（略過沒有形狀者） */
export function toVillages(topo: Topology): FeatureCollection<Geometry, VillProps> {
  return collection<VillProps>(topo, 'villages');
}

/** [[西, 南], [東, 北]]。直接取座標極值：台灣不跨換日線，也不受多邊形繞行方向影響。 */
export function boundsOf(features: Feature[]): [[number, number], [number, number]] {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const visit = (c: unknown): void => {
    if (typeof (c as number[])[0] === 'number') {
      const [x, y] = c as number[];
      if (x < w) w = x;
      if (x > e) e = x;
      if (y < s) s = y;
      if (y > n) n = y;
    } else {
      for (const d of c as unknown[]) visit(d);
    }
  };
  for (const f of features) {
    const g = f.geometry;
    if (g && 'coordinates' in g) visit(g.coordinates);
  }
  return [[w, s], [e, n]];
}

/** 外環的平面面積（經緯度直接當平面，只用來比大小） */
export function ringArea(ring: number[][]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  return Math.abs(a / 2);
}

/** 只保留主要島嶼（面積達該區最大島 ratio 以上）的形狀 */
function mainParts(f: Feature, ratio: number): Feature {
  const g = f.geometry;
  if (!g || g.type !== 'MultiPolygon') return f;
  const areas = g.coordinates.map((p) => ringArea(p[0]));
  const max = Math.max(...areas);
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: g.coordinates.filter((_, i) => areas[i] >= max * ratio) } };
}

/**
 * 視角用的範圍：每個區域只算主要島嶼。
 * 高雄市（旗津區）含東沙、南沙，直接取極值會把範圍拉到南海。
 */
export function mainBounds(features: Feature[], ratio = 0.05): [[number, number], [number, number]] {
  return boundsOf(features.map((f) => mainParts(f, ratio)));
}

export function townOfVillage(villCode: string): string {
  return villCode.slice(0, 8);
}
