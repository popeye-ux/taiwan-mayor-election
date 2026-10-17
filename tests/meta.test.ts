import { describe, it, expect } from 'vitest';
import { MetaIndex } from '../src/data/meta';
import { countyEn } from '../src/data/countyEn';
import { META } from './fixtures/meta';

describe('MetaIndex', () => {
  const m = new MetaIndex(META);
  it('years and result years', () => {
    expect(m.years()).toEqual([2014, 2026]);
    expect(m.resultYears()).toEqual([2014]);
    expect(m.baseYear()).toBe(2026);
  });
  it('party of candidate', () => {
    expect(m.partyOfCandidate(1).label).toBe('國民黨');
    expect(m.candidate(2).name).toBe('乙');
  });
  it('contest by year and county', () => {
    expect(m.contest(2026, '臺北市')!.candidates.length).toBe(3);
    expect(m.contest(2018, '臺北市')).toBeUndefined();
  });
  it('unknown party throws', () => {
    expect(() => m.party(999)).toThrow();
  });
});

describe('countyEn', () => {
  it('known and unknown names', () => {
    expect(countyEn('臺北市')).toBe('Taipei City');
    expect(countyEn('桃園縣')).toBe('Taoyuan County');
    expect(countyEn('桃園市')).toBe('Taoyuan City');
    expect(countyEn('不存在')).toBe('');
  });
});
