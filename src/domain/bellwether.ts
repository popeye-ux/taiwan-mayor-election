// 章魚區（風向球）：得票結構最接近全縣市的鄉鎮與村里。規則見 GIS 規格第二節、design.md 二「圖層」。
import { interpolateRgb } from 'd3-interpolate';
import type { Level, ResultRow } from '../data/types';
import { NONE } from './fill';

/** 清單門檻：偏差 ≤ 2 pp */
export const BW_MAX = 2;
/** 村里有效票下限（票數太少，偏差沒有意義） */
export const BW_MIN_VALID = 300;
/** 色階：0 pp 最深、≥ 10 pp 最淺 */
export const BW_RAMP_MAX = 10;
export const BW_DEEP = '#0E7C74';
export const BW_PALE = '#CDEBE6';

const ramp = interpolateRgb(BW_DEEP, BW_PALE);

export type BwStatus =
  | { kind: 'ok'; dev: number }
  /** 第一名不是縣市當選人，不可能是章魚區 */
  | { kind: 'notWinner'; dev: number }
  /** 村里有效票不足 */
  | { kind: 'lowValid' }
  /** 沒有資料、縣市層、未開票 */
  | { kind: 'na' };

export function bwStatus(row: ResultRow | undefined, level: Level, countyWinner: number | undefined): BwStatus {
  if (!row || level === 'county' || row.bw_dev === null || row.bw_dev === undefined || countyWinner === undefined) {
    return { kind: 'na' };
  }
  if (row.winner !== countyWinner) return { kind: 'notWinner', dev: row.bw_dev };
  if (level === 'village' && row.valid < BW_MIN_VALID) return { kind: 'lowValid' };
  return { kind: 'ok', dev: row.bw_dev };
}

export function bwFill(st: BwStatus): string {
  return st.kind === 'ok' ? ramp(Math.min(st.dev, BW_RAMP_MAX) / BW_RAMP_MAX) : NONE;
}

export function isBellwether(st: BwStatus): boolean {
  return st.kind === 'ok' && st.dev <= BW_MAX;
}

export interface BwCandidate {
  /** 跨屆 id（2026 基準） */
  id: string;
  name: string;
  row: ResultRow;
  countyWinner: number | undefined;
}

export interface BwEntry { id: string; name: string; devs: number[]; mean: number }

const round2 = (x: number) => Math.round(x * 100) / 100;

function qualifies(c: BwCandidate, level: 'town' | 'village'): number | null {
  if (c.row.group) return null; // 村里群組不列入清單
  const st = bwStatus(c.row, level, c.countyWinner);
  return isBellwether(st) && st.kind === 'ok' ? st.dev : null;
}

const byMean = (a: BwEntry, b: BwEntry) => a.mean - b.mean || a.name.localeCompare(b.name, 'zh-Hant');

/** 每一屆都符合門檻者（某屆找不到對應就不算），依平均偏差由小到大 */
export function stableBellwethers(byYear: Map<number, BwCandidate[]>, years: number[], level: 'town' | 'village'): BwEntry[] {
  const index = years.map((y) => new Map((byYear.get(y) ?? []).map((c) => [c.id, c])));
  const out: BwEntry[] = [];
  for (const last of index[index.length - 1]?.values() ?? []) {
    const devs: number[] = [];
    for (const m of index) {
      const c = m.get(last.id);
      const d = c ? qualifies(c, level) : null;
      if (d === null) break;
      devs.push(d);
    }
    if (devs.length !== years.length) continue;
    out.push({ id: last.id, name: last.name, devs, mean: round2(devs.reduce((a, b) => a + b, 0) / devs.length) });
  }
  return out.sort(byMean);
}

/** 單一屆符合門檻者，依偏差由小到大 */
export function currentBellwethers(cands: BwCandidate[], level: 'town' | 'village'): BwEntry[] {
  const out: BwEntry[] = [];
  for (const c of cands) {
    const d = qualifies(c, level);
    if (d !== null) out.push({ id: c.id, name: c.name, devs: [d], mean: d });
  }
  return out.sort(byMean);
}
