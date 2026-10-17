import { describe, it, expect } from 'vitest';
import { interpolateRgb } from 'd3-interpolate';
import {
  bwStatus, bwFill, isBellwether, stableBellwethers, currentBellwethers, BW_DEEP, BW_PALE,
  type BwCandidate, type BwStatus,
} from '../src/domain/bellwether';
import { NONE } from '../src/domain/fill';
import type { ResultRow } from '../src/data/types';
import { row } from './fixtures/store';

const r = (p: Partial<ResultRow>): ResultRow => ({ ...row(1, 'X', 'X縣', 'Y鄉', ['1']), ...p });

describe('bwStatus', () => {
  it('ok, notWinner, lowValid, na', () => {
    expect(bwStatus(r({ bw_dev: 1.2 }), 'town', 1)).toEqual({ kind: 'ok', dev: 1.2 });
    expect(bwStatus(r({ bw_dev: 1.2, winner: 2 }), 'town', 1)).toEqual({ kind: 'notWinner', dev: 1.2 });
    expect(bwStatus(r({ bw_dev: 1.2, valid: 299 }), 'village', 1)).toEqual({ kind: 'lowValid' });
    expect(bwStatus(r({ bw_dev: 1.2, valid: 299 }), 'town', 1)).toEqual({ kind: 'ok', dev: 1.2 }); // 門檻只用在村里
    expect(bwStatus(r({ bw_dev: null }), 'town', 1)).toEqual({ kind: 'na' });
    expect(bwStatus(r({}), 'town', 1)).toEqual({ kind: 'na' });
    expect(bwStatus(r({ bw_dev: 1.2 }), 'town', undefined)).toEqual({ kind: 'na' });
    expect(bwStatus(r({ bw_dev: 0 }), 'county', 1)).toEqual({ kind: 'na' });
    expect(bwStatus(undefined, 'town', 1)).toEqual({ kind: 'na' });
  });
  it('first place differs takes precedence over low valid votes', () => {
    expect(bwStatus(r({ bw_dev: 1.2, valid: 100, winner: 2 }), 'village', 1)).toEqual({ kind: 'notWinner', dev: 1.2 });
  });
});

describe('bwFill', () => {
  it('ramps from deep at 0 to pale at ≥ 10', () => {
    const ramp = interpolateRgb(BW_DEEP, BW_PALE);
    expect(bwFill({ kind: 'ok', dev: 0 })).toBe(ramp(0));
    expect(bwFill({ kind: 'ok', dev: 5 })).toBe(ramp(0.5));
    expect(bwFill({ kind: 'ok', dev: 10 })).toBe(ramp(1));
    expect(bwFill({ kind: 'ok', dev: 25 })).toBe(ramp(1));
  });
  it('anything else is NONE', () => {
    const others: BwStatus[] = [{ kind: 'notWinner', dev: 0 }, { kind: 'lowValid' }, { kind: 'na' }];
    for (const st of others) expect(bwFill(st)).toBe(NONE);
  });
});

it('isBellwether uses ≤ 2', () => {
  expect(isBellwether({ kind: 'ok', dev: 2 })).toBe(true);
  expect(isBellwether({ kind: 'ok', dev: 2.01 })).toBe(false);
  expect(isBellwether({ kind: 'notWinner', dev: 0.5 })).toBe(false);
  expect(isBellwether({ kind: 'lowValid' })).toBe(false);
});

describe('stableBellwethers', () => {
  const c = (id: string, dev: number, extra: Partial<ResultRow> = {}): BwCandidate =>
    ({ id, name: id, row: r({ bw_dev: dev, ...extra }), countyWinner: 1 });
  const years = [2014, 2018, 2022];

  it('every year must qualify; sorted by mean', () => {
    const by = new Map([
      [2014, [c('a', 1), c('b', 0.5), c('x', 1)]],
      [2018, [c('a', 1.5), c('b', 0.5), c('x', 3)]],
      [2022, [c('a', 0.5), c('b', 0.2), c('x', 1)]],
    ]);
    expect(stableBellwethers(by, years, 'town').map((e) => [e.id, e.devs, e.mean]))
      .toEqual([['b', [0.5, 0.5, 0.2], 0.4], ['a', [1, 1.5, 0.5], 1]]);
  });
  it('name comes from the last year', () => {
    const by = new Map(years.map((y) => [y, [{ ...c('a', 1), name: `a${y}` }]]));
    expect(stableBellwethers(by, years, 'town')[0].name).toBe('a2022');
  });
  it('missing in one year is excluded', () => {
    const by = new Map([[2014, [c('a', 1)]], [2018, []], [2022, [c('a', 1)]]]);
    expect(stableBellwethers(by, years, 'town')).toEqual([]);
  });
  it('first place differs in one year is excluded', () => {
    const by = new Map([[2014, [c('a', 1)]], [2018, [c('a', 1, { winner: 2 })]], [2022, [c('a', 1)]]]);
    expect(stableBellwethers(by, years, 'town')).toEqual([]);
  });
  it('village with too few votes in one year is excluded', () => {
    const by = new Map([[2014, [c('a', 1)]], [2018, [c('a', 1, { valid: 200 })]], [2022, [c('a', 1)]]]);
    expect(stableBellwethers(by, years, 'village')).toEqual([]);
  });
  it('groups are excluded', () => {
    const g = c('g', 0.1, { group: true });
    const by = new Map(years.map((y) => [y, [g]]));
    expect(stableBellwethers(by, years, 'village')).toEqual([]);
    expect(currentBellwethers([g], 'village')).toEqual([]);
  });
});

describe('currentBellwethers', () => {
  it('one year, sorted by dev', () => {
    const c = (id: string, dev: number): BwCandidate => ({ id, name: id, row: r({ bw_dev: dev }), countyWinner: 1 });
    expect(currentBellwethers([c('a', 1.5), c('b', 0.3), c('x', 4)], 'town').map((e) => [e.id, e.devs, e.mean]))
      .toEqual([['b', [0.3], 0.3], ['a', [1.5], 1.5]]);
  });
});
