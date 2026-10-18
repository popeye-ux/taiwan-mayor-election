import { describe, it, expect } from 'vitest';
import { toBaseGeo, toVillages, boundsOf, mainBounds, townOfVillage } from '../src/geo/topo';
import type { Feature } from 'geojson';
import type { Topology } from 'topojson-specification';
import { BASE_TOPO, VILL_TOPO } from './fixtures/topo';

describe('topo', () => {
  it('toBaseGeo returns counties and towns', () => {
    const g = toBaseGeo(BASE_TOPO);
    expect(g.counties.features.map((f) => f.properties.COUNTYCODE)).toEqual(['63000', '68000']);
    expect(g.towns.features.length).toBe(2);
  });
  it('coast: each county keeps only arcs not shared with another county', () => {
    // 兩個相鄰方形，共用 x=1 那條邊
    const topo = {
      type: 'Topology',
      arcs: [[[1, 0], [1, 1]], [[1, 1], [0, 1], [0, 0], [1, 0]], [[1, 0], [2, 0], [2, 1], [1, 1]]],
      objects: {
        counties: { type: 'GeometryCollection', geometries: [
          { type: 'Polygon', arcs: [[1, 0]], properties: { COUNTYCODE: 'A', COUNTYNAME: 'A' } },
          { type: 'Polygon', arcs: [[2, -1]], properties: { COUNTYCODE: 'B', COUNTYNAME: 'B' } },
        ] },
        towns: { type: 'GeometryCollection', geometries: [] },
      },
    } as unknown as Topology;
    const coast = toBaseGeo(topo).coast.features;
    expect(coast.map((f) => f.properties.COUNTYCODE)).toEqual(['A', 'B']);
    expect(coast[0].geometry.coordinates).toEqual([[[1, 1], [0, 1], [0, 0], [1, 0]]]);
    expect(coast[1].geometry.coordinates).toEqual([[[1, 0], [2, 0], [2, 1], [1, 1]]]);
  });
  it('toVillages skips null geometry', () => {
    const v = toVillages(VILL_TOPO);
    expect(v.features.map((f) => f.properties.VILLCODE)).toEqual(['63000010001', '68000010001']);
  });
  it('boundsOf covers all features', () => {
    const b = boundsOf(toBaseGeo(BASE_TOPO).counties.features);
    expect(b[0][0]).toBeCloseTo(0);
    expect(b[0][1]).toBeCloseTo(0);
    expect(b[1][0]).toBeCloseTo(3);
    expect(b[1][1]).toBeCloseTo(1);
  });
  it('townOfVillage', () => {
    expect(townOfVillage('68000010001')).toBe('68000010');
  });

  it('mainBounds ignores far-away small islands', () => {
    // 高雄市含南沙太平島：本島 1×1 度，遠方小島 0.01×0.01 度
    const f: Feature = {
      type: 'Feature', properties: {},
      geometry: { type: 'MultiPolygon', coordinates: [
        [[[120, 22], [121, 22], [121, 23], [120, 23], [120, 22]]],
        [[[114, 10], [114.01, 10], [114.01, 10.01], [114, 10.01], [114, 10]]],
      ] },
    };
    expect(mainBounds([f])).toEqual([[120, 22], [121, 23]]);
    expect(boundsOf([f])[0]).toEqual([114, 10]);
  });
});
