import { describe, it, expect } from 'vitest';
import { ElectionStore } from '../src/data/store';
import { createLookups, fillOf, tooltipLines } from '../src/views/common';
import { NONE } from '../src/domain/fill';
import { bwFill } from '../src/domain/bellwether';
import { DEFAULT_STATE, validate } from '../src/state/url';
import type { PaneHit } from '../src/map/pane';
import type { ResultRow } from '../src/data/types';
import { FILES, fakeCache } from './fixtures/store';

/** 覆寫 2014 鄉鎮、村里列的欄位 */
async function storeWith(town: Partial<ResultRow> = {}, village: Partial<ResultRow> = {}) {
  const files = structuredClone(FILES);
  const t = files['/data/json/2014/town.json'] as ResultRow[];
  t[0] = { ...t[0], bw_dev: 1.23, ...town };
  const v = files['/data/json/2014/village.json'] as ResultRow[];
  v[0] = { ...v[0], bw_dev: 0.5, ...village };
  const store = new ElectionStore(fakeCache(files));
  await store.init();
  await store.ensureTowns();
  await store.ensureVillages();
  return store;
}

const townHit: PaneHit = { source: 'towns', code: '63000010', props: { COUNTYCODE: '63000', COUNTYNAME: '臺北市', TOWNCODE: '63000010', TOWNNAME: '松山區' } };
const villHit = (extra: Record<string, string> = {}): PaneHit => ({
  source: 'villages', code: '63000010001',
  props: { COUNTYCODE: '63000', COUNTYNAME: '臺北市', TOWNCODE: '63000010', TOWNNAME: '松山區', VILLCODE: '63000010001', VILLNAME: '莊敬里', ...extra },
});

describe('tooltipLines', () => {
  it('bellwether: deviation', async () => {
    const store = await storeWith();
    expect(tooltipLines(store, 2014, townHit, 'bellwether')).toContain('偏差 1.23 pp');
  });
  it('bellwether: first place differs', async () => {
    const store = await storeWith({ winner: 2 });
    expect(tooltipLines(store, 2014, townHit, 'bellwether')).toContain('第一名與全縣市不同');
  });
  it('bellwether: too few valid votes', async () => {
    const store = await storeWith({}, { valid: 200 });
    expect(tooltipLines(store, 2014, villHit(), 'bellwether')).toContain('有效票不足 300');
  });
  it('bellwether line only on bellwether layer', async () => {
    const store = await storeWith();
    expect(tooltipLines(store, 2014, townHit, 'party').join()).not.toContain('偏差');
  });
  it('notes borrowed shape', async () => {
    const store = await storeWith();
    expect(tooltipLines(store, 2014, villHit({ BORROWED: '2018' }), 'party').at(-1)).toBe('形狀借用 2018 年圖資');
    expect(tooltipLines(store, 2014, villHit(), 'party').join()).not.toContain('借用');
  });
  it('title: village includes township', async () => {
    const store = await storeWith();
    expect(tooltipLines(store, 2014, villHit(), 'party')[0]).toMatch(/^臺北市 · 松山區 · /);
    expect(tooltipLines(store, 2014, townHit, 'party')[0]).toMatch(/^臺北市 · [^·]+$/);
  });
});

describe('fillOf', () => {
  it('bellwether: county level and 2026 are NONE', async () => {
    const store = await storeWith();
    expect(fillOf(store, 2014, 'bellwether', 'county', '63000')).toBe(NONE);
    expect(fillOf(store, 2026, 'bellwether', 'town', '63000010')).toBe(NONE);
  });
  it('bellwether: town and village use bw status', async () => {
    const store = await storeWith();
    expect(fillOf(store, 2014, 'bellwether', 'town', '63000010')).toBe(bwFill({ kind: 'ok', dev: 1.23 }));
    expect(fillOf(store, 2014, 'bellwether', 'village', '63000010001')).toBe(bwFill({ kind: 'ok', dev: 0.5 }));
  });
  it('party layer uses winner color', async () => {
    const store = await storeWith();
    expect(fillOf(store, 2014, 'party', 'town', '63000010')).toBe('#3B6FFF');
  });
});

it('validateCtx keeps known year, drops unknown', async () => {
  const store = await storeWith();
  const ctx = createLookups(store).validateCtx(false);
  expect(validate({ ...DEFAULT_STATE, year: 2014 }, ctx).year).toBe(2014);
  expect(validate({ ...DEFAULT_STATE, year: 2010 }, ctx).year).toBeNull();
});
