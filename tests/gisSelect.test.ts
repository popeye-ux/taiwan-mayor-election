import { describe, it, expect } from 'vitest';
import { ElectionStore } from '../src/data/store';
import { defaultYear, effectiveYear, yearPatch, selectionOutline, bwCandidates } from '../src/views/gisSelect';
import { DEFAULT_STATE, type ViewState } from '../src/state/url';
import { fakeCache } from './fixtures/store';

async function ready(withVillages = true) {
  const store = new ElectionStore(fakeCache());
  await store.init();
  await store.ensureTowns();
  if (withVillages) await store.ensureVillages();
  return store;
}
const s = (p: Partial<ViewState>): ViewState => ({ ...DEFAULT_STATE, ...p });

describe('year', () => {
  it('default year is the last result year and is not written to the url', async () => {
    const store = await ready();
    expect(defaultYear(store.meta)).toBe(2014);
    expect(effectiveYear(s({}), store.meta)).toBe(2014);
    expect(effectiveYear(s({ year: 2026 }), store.meta)).toBe(2026);
    expect(yearPatch(2014, store.meta)).toEqual({ year: null });
    expect(yearPatch(2026, store.meta)).toEqual({ year: 2026 });
  });
});

describe('selectionOutline', () => {
  it('nothing selected → null', async () => {
    expect(selectionOutline(await ready(), 2014, s({}))).toBeNull();
  });
  it('village missing in a year: no outline there, selection untouched, restored when switching back', async () => {
    const store = await ready();
    const id = store.villageIdOf(2014, '63000010009'); // 舊里，2026 沒有
    const sel = s({ county: '63000', town: '63000010', village: id });
    expect(selectionOutline(store, 2014, sel)).toEqual({ source: 'villages', codes: ['63000010009'] });
    expect(selectionOutline(store, 2026, sel)?.codes ?? []).toEqual([]);
    expect(sel.village).toBe(id);
    expect(selectionOutline(store, 2014, sel)).toEqual({ source: 'villages', codes: ['63000010009'] });
  });
  it('group village outlines every member', async () => {
    const store = await ready();
    const sel = s({ county: '63000', town: '63000010', village: store.villageIdOf(2014, '63000010002') });
    expect(selectionOutline(store, 2014, sel)).toEqual({ source: 'villages', codes: ['63000010002', '63000010003'] });
  });
  it('villages not loaded yet → town outline', async () => {
    const store = await ready(false);
    expect(selectionOutline(store, 2014, s({ county: '63000', town: '63000010', village: '63000010001' })))
      .toEqual({ source: 'towns', codes: ['63000010'] });
  });
  it('taoyuan uses the year code', async () => {
    const store = await ready();
    expect(selectionOutline(store, 2014, s({ county: '68000' }))).toEqual({ source: 'counties', codes: ['10003'] });
    expect(selectionOutline(store, 2026, s({ county: '68000' }))).toEqual({ source: 'counties', codes: ['68000'] });
  });
});

describe('bwCandidates', () => {
  it('ids are cross-year ids, with town', async () => {
    const store = await ready();
    expect(bwCandidates(store, 2014, '68000', 'village').map((c) => [c.id, c.town])).toEqual([['68000010001', '68000010']]);
    expect(bwCandidates(store, 2014, '63000', 'town').map((c) => [c.id, c.name, c.countyWinner])).toEqual([['63000010', '松山區', 1]]);
  });
  it('village rows include groups and rows without code (filtered later)', async () => {
    const store = await ready();
    const ids = bwCandidates(store, 2014, '63000', 'village').map((c) => c.id);
    expect(ids).toContain('n:未標示村里（投開票所 320）');
    expect(ids).toContain(store.villageIdOf(2014, '63000010002'));
  });
  it('2026 has no candidates', async () => {
    expect(bwCandidates(await ready(), 2026, '63000', 'town')).toEqual([]);
  });
});
