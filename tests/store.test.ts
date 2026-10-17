import { describe, it, expect } from 'vitest';
import { ElectionStore } from '../src/data/store';
import { fakeCache } from './fixtures/store';

async function ready(withVillages = true) {
  const cache = fakeCache();
  const store = new ElectionStore(cache);
  await store.init();
  await store.ensureTowns();
  if (withVillages) await store.ensureVillages();
  return { store, cache };
}

const short = (urls: string[]) => urls.map((u) => u.replace(/^.*?\/data\//, '')).sort();

describe('ElectionStore', () => {
  it('init loads meta, base of every year, county of result years', async () => {
    const cache = fakeCache();
    await new ElectionStore(cache).init();
    expect(short(cache.requested)).toEqual(
      ['geo/2014/base.json', 'geo/2026/base.json', 'json/2014/county.json', 'json/meta.json']);
  });

  it('ensureVillages loads villages of every year', async () => {
    const { store, cache } = await ready(false);
    expect(store.hasVillages()).toBe(false);
    await store.ensureVillages();
    expect(store.hasVillages()).toBe(true);
    expect(short(cache.requested)).toEqual(expect.arrayContaining(
      ['geo/2014/villages.json', 'geo/2026/villages.json', 'json/2014/village.json']));
  });

  it('taoyuan 2014', async () => {
    const { store } = await ready();
    expect(store.areaCode(2014, '68000')).toBe('10003');
    expect(store.countyRow(2014, '68000')!.name).toBe('桃園縣');
    expect(store.townRow(2014, '68000010')!.name).toBe('桃園市');
    expect(store.villageRow(2014, '68000010001', '68000010')!.name).toBe('中山村');
    expect(store.villagesOfTown(2014, '68000010').features.map((f) => f.properties.VILLCODE)).toEqual(['10003010001']);
  });

  it('group row by any code', async () => {
    const { store } = await ready();
    const a = store.rowByCode(2014, 'village', '63000010002');
    expect(store.rowByCode(2014, 'village', '63000010003')).toBe(a);
    expect(store.villageIdOf(2014, '63000010003')).toBe('63000010002');
    expect(store.villageIdOf(2014, '63000010002')).toBe('63000010002');
    expect(store.villageCodesIn(2014, '63000010002', '63000010')).toEqual(['63000010002', '63000010003']);
    expect(store.villageCodesIn(2026, '63000010002', '63000010')).toEqual(['63000010002']);
  });

  it('no-moi village', async () => {
    const { store } = await ready();
    const names = store.villageRowsOfTown(2014, '63000010').map((r) => r.name);
    expect(names).toEqual(['莊敬里', 'A里、B里', '舊里', '未標示村里（投開票所 320）']);
    expect(store.villageRow(2014, 'n:未標示村里（投開票所 320）', '63000010')!.id).toBe(8);
  });

  it('missing in year', async () => {
    const { store } = await ready();
    expect(store.villageIdOf(2014, '63000010009')).toBe('2014:63000010009');
    expect(store.villageRow(2014, '2014:63000010009', '63000010')!.name).toBe('舊里');
    expect(store.villageRow(2026, '2014:63000010009', '63000010')).toBeUndefined();
    expect(store.villageCodesIn(2026, '2014:63000010009', '63000010')).toEqual([]);
  });

  it('town rows of county', async () => {
    const { store } = await ready();
    expect(store.townRowsOfCounty(2014, '68000').map((r) => r.name)).toEqual(['桃園市']);
  });

  it('failed load can be retried', async () => {
    const cache = fakeCache();
    let fail = true;
    const flaky = {
      get<T>(u: string): Promise<T> {
        return fail && u.endsWith('villages.json') ? Promise.reject(new Error('x')) : cache.get<T>(u);
      },
    };
    const store = new ElectionStore(flaky);
    await store.init();
    await expect(store.ensureVillages()).rejects.toThrow();
    fail = false;
    await store.ensureVillages();
    expect(store.hasVillages()).toBe(true);
  });
});
