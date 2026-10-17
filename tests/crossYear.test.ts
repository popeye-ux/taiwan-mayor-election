import { describe, it, expect } from 'vitest';
import {
  toBaseArea, fromBaseArea, villNamesMatch, pairVillages, buildVillageIds,
} from '../src/data/crossYear';
import type { VillProps } from '../src/data/types';

function v(code: string, name: string): VillProps {
  return {
    COUNTYCODE: code.slice(0, 5), COUNTYNAME: '', TOWNCODE: code.slice(0, 8), TOWNNAME: '',
    VILLCODE: code, VILLNAME: name,
  };
}

describe('area codes', () => {
  it('toBaseArea rewrites taoyuan 2014 prefix', () => {
    expect(toBaseArea('10003010')).toBe('68000010');
    expect(toBaseArea('10003')).toBe('68000');
    expect(toBaseArea('63000010')).toBe('63000010');
  });
  it('fromBaseArea finds the code used in that year', () => {
    expect(fromBaseArea('68000010', new Set(['10003010']))).toBe('10003010');
    expect(fromBaseArea('63000010', new Set(['63000010']))).toBe('63000010');
    expect(fromBaseArea('63000099', new Set(['63000010']))).toBeNull();
  });
});

describe('villNamesMatch', () => {
  it('ignores 村/里 suffix and brackets', () => {
    expect(villNamesMatch('沙崙村', '沙崙里')).toBe(true);
    expect(villNamesMatch('瓦[磘]村', '瓦磘村')).toBe(true);
  });
  it('U+FFFD is a wildcard', () => {
    expect(villNamesMatch('糖�里', '糖廍里')).toBe(true);
    expect(villNamesMatch('糖�里', '糖廍廍里')).toBe(false);
  });
  it('names joined by 、 match any part', () => {
    expect(villNamesMatch('新莊里、關新里', '新莊里')).toBe(true);
  });
  it('different villages do not match', () => {
    expect(villNamesMatch('雙館村', '塩舘村')).toBe(false);
  });
});

describe('pairVillages', () => {
  it('same code and name', () => {
    expect(pairVillages([v('10010010001', '甲村')], [v('10010010001', '甲村')]).get('10010010001')).toBe('10010010001');
  });
  it('same code but different name is not paired', () => {
    expect(pairVillages([v('10010140001', '雙館村')], [v('10010140001', '塩舘村')]).has('10010140001')).toBe(false);
  });
  it('different code, same town and name', () => {
    expect(pairVillages([v('67000010001', '甲里')], [v('67000010009', '甲里')]).get('67000010001')).toBe('67000010009');
  });
  it('ambiguous name in town is not paired', () => {
    const to = [v('67000010008', '甲里'), v('67000010009', '甲里')];
    expect(pairVillages([v('67000010001', '甲里')], to).has('67000010001')).toBe(false);
  });
  it('taoyuan 2014 village to 2026', () => {
    expect(pairVillages([v('10003020001', '大園村')], [v('68000020001', '大園里')]).get('10003020001')).toBe('68000020001');
  });
  it('unnamed areas are skipped', () => {
    const m = pairVillages([v('63000010S01', '')], [v('63000010S01', '')]);
    expect(m.size).toBe(0);
  });
});

describe('buildVillageIds', () => {
  const years = [2014, 2018, 2026];
  const byYear = new Map<number, VillProps[]>([
    [2014, [v('63000010001', '甲里'), v('67000010001', '舊里'), v('67000010002', '中里')]],
    [2018, [v('63000010001', '甲里'), v('67000010005', '中里')]],
    [2026, [v('63000010001', '甲里')]],
  ]);
  const ids = buildVillageIds(byYear, years);
  it('village present in every year uses base code', () => {
    for (const y of years) expect(ids.get(y)!.toId.get('63000010001')).toBe('63000010001');
    expect(ids.get(2014)!.fromId.get('63000010001')).toBe('63000010001');
  });
  it('village only in 2014 gets a year-prefixed id', () => {
    expect(ids.get(2014)!.toId.get('67000010001')).toBe('2014:67000010001');
  });
  it('village in 2014 and 2018 but not 2026 shares the 2018 id', () => {
    expect(ids.get(2014)!.toId.get('67000010002')).toBe('2018:67000010005');
    expect(ids.get(2018)!.toId.get('67000010005')).toBe('2018:67000010005');
    expect(ids.get(2014)!.fromId.get('2018:67000010005')).toBe('67000010002');
  });
});
