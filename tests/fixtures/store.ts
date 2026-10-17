import type { ResultRow } from '../../src/data/types';
import { META } from './meta';

// 2014 與 2026 兩屆：臺北市松山區、桃園（2014 是桃園縣 10003、桃園市 10003010）
const SQUARE = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];

function collection(props: Record<string, string>[]) {
  return { type: 'GeometryCollection', geometries: props.map((p) => ({ type: 'Polygon', arcs: [[0]], properties: p })) };
}
function base(counties: [string, string][], towns: [string, string, string][]) {
  return {
    type: 'Topology', arcs: SQUARE,
    objects: {
      counties: collection(counties.map(([c, n]) => ({ COUNTYCODE: c, COUNTYNAME: n }))),
      towns: collection(towns.map(([c, code, n]) => ({ COUNTYCODE: c, COUNTYNAME: '', TOWNCODE: code, TOWNNAME: n }))),
    },
  };
}
function vills(list: [string, string][]) {
  return {
    type: 'Topology', arcs: SQUARE,
    objects: {
      villages: collection(list.map(([code, n]) => ({
        COUNTYCODE: code.slice(0, 5), COUNTYNAME: '', TOWNCODE: code.slice(0, 8), TOWNNAME: '', VILLCODE: code, VILLNAME: n,
      }))),
    },
  };
}
export function row(id: number, name: string, county: string, town: string | null, moi: string[], group = false): ResultRow {
  return {
    id, contest: 1, name, county, town, group, moi, electors: 1000, valid: 600, turnout: 60,
    votes: [[1, 400, 66.67], [2, 200, 33.33]], winner: 1, margin_votes: 200, margin_pp: 33.34,
  };
}

export const FILES: Record<string, unknown> = {
  '/data/json/meta.json': META,
  '/data/geo/2014/base.json': base([['63000', '臺北市'], ['10003', '桃園縣']],
    [['63000', '63000010', '松山區'], ['10003', '10003010', '桃園市']]),
  '/data/geo/2026/base.json': base([['63000', '臺北市'], ['68000', '桃園市']],
    [['63000', '63000010', '松山區'], ['68000', '68000010', '桃園區']]),
  '/data/geo/2014/villages.json': vills([
    ['63000010001', '莊敬里'], ['63000010002', 'A里'], ['63000010003', 'B里'], ['63000010009', '舊里'], ['10003010001', '中山村'],
  ]),
  '/data/geo/2026/villages.json': vills([
    ['63000010001', '莊敬里'], ['63000010002', 'A里'], ['63000010003', 'B里'], ['68000010001', '中山里'],
  ]),
  '/data/json/2014/county.json': [row(1, '臺北市', '臺北市', null, ['63000']), row(2, '桃園縣', '桃園縣', null, ['10003'])],
  '/data/json/2014/town.json': [row(3, '松山區', '臺北市', '松山區', ['63000010']), row(4, '桃園市', '桃園縣', '桃園市', ['10003010'])],
  '/data/json/2014/village.json': [
    row(5, '莊敬里', '臺北市', '松山區', ['63000010001']),
    row(6, 'A里、B里', '臺北市', '松山區', ['63000010002', '63000010003'], true),
    row(7, '舊里', '臺北市', '松山區', ['63000010009']),
    row(8, '未標示村里（投開票所 320）', '臺北市', '松山區', []),
    row(9, '中山村', '桃園縣', '桃園市', ['10003010001']),
  ],
};

/** 假 cache：回傳 FILES 的內容並記錄被要求的網址。 */
export function fakeCache(files: Record<string, unknown> = FILES) {
  const requested: string[] = [];
  return {
    requested,
    get<T>(url: string): Promise<T> {
      requested.push(url);
      const key = url.replace(/^.*?\/data\//, '/data/');
      if (!(key in files)) return Promise.reject(new Error(`no fixture ${url}`));
      return Promise.resolve(structuredClone(files[key]) as T);
    },
  };
}
