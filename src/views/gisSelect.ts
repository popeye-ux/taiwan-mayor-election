// GIS 的屆次與選取外框：網址的選取一律是 2026 基準，換年份時只換成該屆代碼，不改網址。
import type { ElectionStore } from '../data/store';
import type { MetaIndex } from '../data/meta';
import { toBaseArea } from '../data/crossYear';
import type { BwCandidate } from '../domain/bellwether';
import { townOfVillage } from '../geo/topo';
import type { SourceId } from '../map/pane';
import type { ViewState } from '../state/url';

/** 預設屆次：最後一個有開票結果的屆次 */
export function defaultYear(meta: MetaIndex): number {
  return meta.resultYears().at(-1) ?? meta.baseYear();
}

export function effectiveYear(s: ViewState, meta: MetaIndex): number {
  return s.year ?? defaultYear(meta);
}

/** 換年份時寫進網址的值；等於預設屆次時不寫 */
export function yearPatch(year: number, meta: MetaIndex): { year: number | null } {
  return { year: year === defaultYear(meta) ? null : year };
}

/** 本屆要加選取外框的區塊；本屆找不到時 codes 為空（不畫外框，選取照舊） */
export function selectionOutline(store: ElectionStore, year: number, s: ViewState): { source: SourceId; codes: string[] } | null {
  if (s.town && s.village && store.hasVillages()) {
    return { source: 'villages', codes: store.villageCodesIn(year, s.village, s.town) };
  }
  const one = (source: SourceId, base: string) => {
    const code = store.areaCode(year, base);
    return { source, codes: code ? [code] : [] };
  };
  if (s.town) return one('towns', s.town);
  if (s.county) return one('counties', s.county);
  return null;
}

/** 章魚清單的候選：某縣市本屆的鄉鎮或村里列，id 換成跨屆 id */
export function bwCandidates(store: ElectionStore, year: number, baseCounty: string, level: 'town' | 'village'): BwCandidate[] {
  if (!store.meta.hasResults(year)) return [];
  const towns = store.townRowsOfCounty(year, baseCounty);
  const cand = (row: BwCandidate['row'], id: string, town?: string): BwCandidate =>
    ({ id, name: row.name, row, countyWinner: store.countyWinner(year, row.contest), town });
  if (level === 'town') return towns.filter((r) => r.moi.length).map((r) => cand(r, toBaseArea(r.moi[0])));
  const out: BwCandidate[] = [];
  for (const t of towns) {
    if (!t.moi.length) continue;
    const baseTown = toBaseArea(t.moi[0]);
    for (const r of store.villageRowsOfTown(year, baseTown)) {
      const id = r.moi.length ? store.villageIdOf(year, r.moi[0]) : `n:${r.name}`;
      out.push(cand(r, id, r.moi.length ? toBaseArea(townOfVillage(r.moi[0])) : baseTown));
    }
  }
  return out;
}
