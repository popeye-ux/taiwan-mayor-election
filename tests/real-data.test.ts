// 真實資料抽查：讀 public/data/（由 npm run sync 產生），不存在則略過。
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ElectionStore } from '../src/data/store';
import { toBaseArea } from '../src/data/crossYear';

const DATA = path.resolve(__dirname, '../public/data');
const has = fs.existsSync(path.join(DATA, 'json/meta.json'));

const fsCache = {
  get<T>(url: string): Promise<T> {
    const rel = url.replace(/^.*?\/data\//, '');
    return Promise.resolve(JSON.parse(fs.readFileSync(path.join(DATA, rel), 'utf8')) as T);
  },
};

describe.skipIf(!has)('real data', () => {
  let store: ElectionStore;
  beforeAll(async () => {
    store = new ElectionStore(fsCache);
    await store.init();
    await store.ensureVillages();
  }, 60_000);

  it('2022 Taipei winner', () => {
    const r = store.countyRow(2022, '63000')!;
    expect(store.meta.candidate(r.winner).name).toBe('蔣萬安');
    expect(store.meta.partyOfCandidate(r.winner).label).toBe('國民黨');
    expect(r.votes[0][2]).toBe(42.29);
  });

  it('2018 has 9 flipped counties', () => {
    expect(store.countyRows(2018).filter((r) => r.flipped === true).length).toBe(9);
  });

  it('town moi codes exist in the same year base.json', () => {
    for (const y of store.meta.resultYears()) {
      const codes = new Set(store.baseGeo(y).towns.features.map((f) => f.properties.TOWNCODE));
      const rows = (store as unknown as { results: Map<string, { rows: { moi: string[] }[] }> }).results.get(`${y}|town`)!.rows;
      const missing = rows.flatMap((r) => r.moi).filter((c) => !codes.has(c));
      expect(missing, `${y}`).toEqual([]);
    }
  });

  it('every county and town maps to the 2026 base', () => {
    const base = store.baseGeo(2026);
    const codes = new Set([
      ...base.counties.features.map((f) => f.properties.COUNTYCODE),
      ...base.towns.features.map((f) => f.properties.TOWNCODE),
    ]);
    for (const y of store.meta.resultYears()) {
      const g = store.baseGeo(y);
      const all = [...g.counties.features.map((f) => f.properties.COUNTYCODE), ...g.towns.features.map((f) => f.properties.TOWNCODE)];
      expect(all.filter((c) => !codes.has(toBaseArea(c))), `${y}`).toEqual([]);
    }
  });

  // 2018 年選後屏東市、臺東市、東港鎮等合併村里，加上少數異體字（永豊／永豐），共 46 個對不到 2026；
  // 2022 只有壯圍鄉忠孝村。數字改變代表圖資或對應規則變了，要重新檢查。
  it('villages without a 2026 counterpart', () => {
    const ids = (store as unknown as { villageIds: Map<number, { toId: Map<string, string> }> }).villageIds;
    const unmapped = (y: number) => [...ids.get(y)!.toId.values()].filter((id) => id.includes(':')).length;
    expect(unmapped(2018)).toBe(46);
    expect(unmapped(2022)).toBe(1);
  });

  it('2014 塩舘村 uses the borrowed 2018 shape and maps to 2026', () => {
    // 2014-05 圖資的雙館村已拿掉，同代碼改為借用 2018 形狀的塩舘村（2026-10-17）
    const f = store.villagesOfTown(2014, '10010130').features.find((x) => x.properties.VILLCODE === '10010130002');
    expect(f?.properties.VILLNAME).toBe('塩舘村');
    expect(f?.properties.BORROWED).toBe('2018');
    expect(store.villageIdOf(2014, '10010130002')).toBe('10010130002');
  });

  it('2014 蘆竹 borrowed villages map to 2026 codes', () => {
    expect(store.villageIdOf(2014, '10003050027')).toBe('68000050027');
  });
});
