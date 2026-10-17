import { describe, it, expect } from 'vitest';
import { toBaseGeo, toVillages, boundsOf, townOfVillage } from '../src/geo/topo';
import { BASE_TOPO, VILL_TOPO } from './fixtures/topo';

describe('topo', () => {
  it('toBaseGeo returns counties and towns', () => {
    const g = toBaseGeo(BASE_TOPO);
    expect(g.counties.features.map((f) => f.properties.COUNTYCODE)).toEqual(['63000', '68000']);
    expect(g.towns.features.length).toBe(2);
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
});
