// 跨屆對應：以最後一屆（2026）的圖資代碼為基準。規則見 compare-view 規格第三節。
import type { VillProps } from './types';

const TAOYUAN_2014 = '10003';
const TAOYUAN = '68000';
const WILDCARD = '�';

/** 本屆代碼 → 基準代碼（縣市、鄉鎮、村里皆可）：2014 桃園縣 10003 開頭換成 68000。 */
export function toBaseArea(code: string): string {
  return code.startsWith(TAOYUAN_2014) ? TAOYUAN + code.slice(TAOYUAN_2014.length) : code;
}

/** 基準代碼 → 本屆實際使用的代碼；本屆沒有時回傳 null。 */
export function fromBaseArea(baseCode: string, codesInYear: Set<string>): string | null {
  if (codesInYear.has(baseCode)) return baseCode;
  if (baseCode.startsWith(TAOYUAN)) {
    const old = TAOYUAN_2014 + baseCode.slice(TAOYUAN.length);
    if (codesInYear.has(old)) return old;
  }
  return null;
}

/** 去方括號、去結尾的「村」「里」 */
export function normVillName(name: string): string {
  return name.replace(/[[\]]/g, '').replace(/[村里]$/, '');
}

function sameName(a: string, b: string): boolean {
  const x = [...normVillName(a)];
  const y = [...normVillName(b)];
  return x.length === y.length && x.every((ch, i) => ch === y[i] || ch === WILDCARD || y[i] === WILDCARD);
}

/** 名稱以「、」串接的（kiang 版共用形狀）拆開來比，任一組相符即可；U+FFFD 對任一字元。 */
export function villNamesMatch(a: string, b: string): boolean {
  const as = a.split('、');
  const bs = b.split('、');
  return as.some((x) => bs.some((y) => sameName(x, y)));
}

/** from 屆村里代碼 → to 屆村里代碼。只處理有村名者。 */
export function pairVillages(from: VillProps[], to: VillProps[]): Map<string, string> {
  const byCode = new Map<string, VillProps>();
  const byTown = new Map<string, VillProps[]>();
  for (const t of to) {
    if (!t.VILLNAME) continue;
    byCode.set(toBaseArea(t.VILLCODE), t);
    const k = toBaseArea(t.TOWNCODE);
    (byTown.get(k) ?? byTown.set(k, []).get(k)!).push(t);
  }
  const out = new Map<string, string>();
  for (const f of from) {
    if (!f.VILLNAME) continue;
    const same = byCode.get(toBaseArea(f.VILLCODE));
    if (same && villNamesMatch(f.VILLNAME, same.VILLNAME)) {
      out.set(f.VILLCODE, same.VILLCODE);
      continue;
    }
    const cands = (byTown.get(toBaseArea(f.TOWNCODE)) ?? []).filter((t) => villNamesMatch(f.VILLNAME, t.VILLNAME));
    if (cands.length === 1) out.set(f.VILLCODE, cands[0].VILLCODE);
  }
  return out;
}

export interface VillageIds {
  /** 本屆代碼 → 村里 id（基準代碼，或 `${year}:${code}`） */
  toId: Map<string, string>;
  /** 村里 id → 本屆代碼 */
  fromId: Map<string, string>;
}

/** years 由舊到新，最後一屆為基準。每個村沿下一屆的配對一路往後走，以走到的最後一屆代碼為 id。 */
export function buildVillageIds(byYear: Map<number, VillProps[]>, years: number[]): Map<number, VillageIds> {
  const base = years[years.length - 1];
  const next = years.slice(0, -1).map((y, i) => pairVillages(byYear.get(y) ?? [], byYear.get(years[i + 1]) ?? []));
  const result = new Map<number, VillageIds>();
  years.forEach((y, i) => {
    const ids: VillageIds = { toId: new Map(), fromId: new Map() };
    for (const v of byYear.get(y) ?? []) {
      if (!v.VILLNAME) continue;
      let code = v.VILLCODE;
      let k = i;
      while (k < years.length - 1) {
        const n = next[k].get(code);
        if (n === undefined) break;
        code = n;
        k++;
      }
      const id = years[k] === base ? code : `${years[k]}:${code}`;
      ids.toId.set(v.VILLCODE, id);
      if (!ids.fromId.has(id)) ids.fromId.set(id, v.VILLCODE);
    }
    result.set(y, ids);
  });
  return result;
}
