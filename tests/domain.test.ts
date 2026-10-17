import { describe, it, expect } from 'vitest';
import { interpolateRgb } from 'd3-interpolate';
import { pct2, pct1, pp2, ppSigned1, int } from '../src/domain/format';
import { fillFor, NONE, FLIP_YES, FLIP_NO } from '../src/domain/fill';
import { flipBetween } from '../src/domain/flip';
import { seatsByParty, weightedTurnout, flipCount } from '../src/domain/national';
import { stackSegments } from '../src/domain/stack';
import { MetaIndex } from '../src/data/meta';
import type { Meta, ResultRow, Vote } from '../src/data/types';
import { META } from './fixtures/meta';
import { row } from './fixtures/store';

const meta = new MetaIndex(META);
// 候選人 1 = 國民黨、2 = 無黨籍（META 的 2014 臺北市）、4 = 民進黨（2026）
const winnerRow = (winner: number, extra: Partial<ResultRow> = {}): ResultRow => ({ ...row(1, 'X', 'X', null, []), winner, ...extra });

describe('format', () => {
  it('formats numbers', () => {
    expect(pct2(42.294)).toBe('42.29%');
    expect(pct1(42.29)).toBe('42.3%');
    expect(pp2(20.4)).toBe('20.40 pp');
    expect(ppSigned1(20.4)).toBe('+20.4 pp');
    expect(int(575590)).toBe('575,590');
  });
});

describe('fillFor', () => {
  it('party layer uses winner party color', () => {
    expect(fillFor('party', winnerRow(1), meta, null)).toBe('#3B6FFF');
  });
  it('margin layer interpolates from NONE', () => {
    const k0 = interpolateRgb(NONE, '#3B6FFF')(0.18);
    expect(fillFor('margin', winnerRow(1, { margin_pp: 0 }), meta, null)).toBe(k0);
    expect(fillFor('margin', winnerRow(1, { margin_pp: 40 }), meta, null)).toBe(interpolateRgb(NONE, '#3B6FFF')(1));
  });
  it('turnout layer clamps to 40–75', () => {
    expect(fillFor('turnout', winnerRow(1, { turnout: 30 }), meta, null))
      .toBe(fillFor('turnout', winnerRow(1, { turnout: 40 }), meta, null));
    expect(fillFor('turnout', winnerRow(1, { turnout: 80 }), meta, null))
      .toBe(fillFor('turnout', winnerRow(1, { turnout: 75 }), meta, null));
  });
  it('flip layer', () => {
    expect(fillFor('flip', winnerRow(1), meta, null)).toBe(NONE);
    expect(fillFor('flip', winnerRow(1), meta, true)).toBe(FLIP_YES);
    expect(fillFor('flip', winnerRow(1), meta, false)).toBe(FLIP_NO);
  });
  it('no row is NONE', () => {
    expect(fillFor('party', undefined, meta, null)).toBe(NONE);
  });
});

describe('flipBetween', () => {
  it('compares winner party short codes', () => {
    expect(flipBetween(winnerRow(1), winnerRow(2), meta)).toBe(true);
    expect(flipBetween(winnerRow(1), winnerRow(3), meta)).toBe(false);
    expect(flipBetween(winnerRow(1), undefined, meta)).toBeNull();
    expect(flipBetween(undefined, winnerRow(1), meta)).toBeNull();
  });
});

describe('national', () => {
  it('seats by party, most first', () => {
    const s = seatsByParty([winnerRow(2), winnerRow(1), winnerRow(3)], meta);
    expect(s.map((x) => [x.party.short, x.seats])).toEqual([['KMT', 2], ['IND', 1]]);
  });
  it('weighted turnout', () => {
    expect(weightedTurnout([winnerRow(1, { electors: 100, turnout: 50 }), winnerRow(1, { electors: 300, turnout: 70 })])).toBe(65);
  });
  it('flip count', () => {
    expect(flipCount([winnerRow(1, { flipped: true }), winnerRow(1, { flipped: false }), winnerRow(1, { flipped: null })])).toBe(1);
  });
});

describe('stackSegments', () => {
  const bigMeta = new MetaIndex({
    ...META,
    contests: [{ ...META.contests[0], candidates: [1, 2, 3, 4, 5].map((id) => ({
      id, ballot_no: id, name: `候${id}`, party: 1, gender: null, age: null, incumbent: null, elected: null,
    })) }],
  } as Meta);
  it('top three plus ≥5%, rest as other', () => {
    const votes: Vote[] = [[1, 40, 40], [2, 30, 30], [3, 20, 20], [4, 6, 6], [5, 4, 4]];
    const s = stackSegments(winnerRow(1, { votes }), bigMeta);
    expect(s.map((x) => [x.label, x.pct])).toEqual([['候1', 40], ['候2', 30], ['候3', 20], ['候4', 6], ['其他', 4]]);
    expect(s[4].color).toBe('#8A90A6');
  });
  it('no other segment when nothing is left', () => {
    const votes: Vote[] = [[1, 60, 60], [2, 40, 40]];
    expect(stackSegments(winnerRow(1, { votes }), bigMeta).map((x) => x.label)).toEqual(['候1', '候2']);
  });
});
