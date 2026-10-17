// 四屆比較與 GIS 共用：查詢、填色、tooltip 文字，以及提供給側欄元件的 ViewCtx。
import type { InjectionKey, Ref, ShallowRef } from 'vue';
import type { ElectionStore } from '../data/store';
import { toBaseArea } from '../data/crossYear';
import type { Layer, Level, ResultRow } from '../data/types';
import { fillFor, NONE } from '../domain/fill';
import { flipBetween } from '../domain/flip';
import { bwStatus, BW_MIN_VALID, type BwStatus } from '../domain/bellwether';
import { int, pct2, pp2 } from '../domain/format';
import { townOfVillage } from '../geo/topo';
import type { PaneHit } from '../map/pane';
import type { ValidateCtx, ViewState } from '../state/url';
import type { LoadStatus } from './flow';

export const BORROWED_NOTE = '形狀借用 2018 年圖資';
const stripBrackets = (s: string) => s.replace(/[[\]]/g, '');

/** 側欄元件以 inject(ViewKey) 取得；四屆比較與 GIS 各自提供 */
export interface ViewCtx {
  store: ElectionStore;
  status: Ref<'loading' | 'ready' | 'error'>;
  load: ShallowRef<LoadStatus>;
  /** 每次載入新資料就 +1，讓依賴 store 的 computed 重新計算 */
  version: Ref<number>;
  state: Readonly<Ref<ViewState>>;
  set(next: Partial<ViewState>): void;
  retry(): void;
  rowAt(year: number, s?: ViewState): ResultRow | undefined;
  flipAt(year: number, s?: ViewState): boolean | null;
  countyName(baseCounty: string): string;
  townName(baseTown: string): string;
  villageName(id: string, baseTown: string): string;
  /** GIS 目前顯示的屆次；四屆比較為 null */
  currentYear: Readonly<Ref<number | null>>;
}

export const ViewKey: InjectionKey<ViewCtx> = Symbol('view');

/** 前一個有開票結果的屆次 */
function prevResultYear(store: ElectionStore, year: number): number | null {
  const ys = store.meta.years();
  const p = ys[ys.indexOf(year) - 1];
  return p !== undefined && store.meta.hasResults(p) ? p : null;
}

export function createLookups(store: ElectionStore) {
  const baseYear = () => store.meta.baseYear();
  const prevYear = (year: number) => prevResultYear(store, year);

  function validateCtx(withVillages: boolean): ValidateCtx {
    const g = store.baseGeo(baseYear());
    const ctx: ValidateCtx = {
      hasYear: (y) => store.meta.years().includes(y),
      hasCounty: (c) => g.counties.features.some((f) => f.properties.COUNTYCODE === c),
      townInCounty: (t, c) => g.towns.features.some((f) => f.properties.TOWNCODE === t && f.properties.COUNTYCODE === c),
    };
    if (withVillages) {
      ctx.villageValid = (id, town) => {
        if (!id.startsWith('n:')) {
          const code = id.includes(':') ? id.split(':')[1] : id;
          if (toBaseArea(townOfVillage(code)) !== town) return false;
        }
        return store.meta.years().some((y) => store.villageCodesIn(y, id, town).length > 0 || !!store.villageRow(y, id, town));
      };
    }
    return ctx;
  }

  /** 選取區域在某屆的結果列（最深一層） */
  function rowAt(year: number, s: ViewState): ResultRow | undefined {
    if (s.town && s.village) return store.villageRow(year, s.village, s.town);
    if (s.town) return store.townRow(year, s.town);
    if (s.county) return store.countyRow(year, s.county);
    return undefined;
  }

  /** 選取區域在某屆是否輪替；縣市層用 JSON 的 flipped */
  function flipAt(year: number, s: ViewState): boolean | null {
    const cur = rowAt(year, s);
    if (!s.town) return cur?.flipped ?? null;
    const p = prevYear(year);
    return p === null ? null : flipBetween(cur, rowAt(p, s), store.meta);
  }

  function countyName(baseCounty: string): string {
    const f = store.baseGeo(baseYear()).counties.features.find((x) => x.properties.COUNTYCODE === baseCounty);
    return f?.properties.COUNTYNAME ?? '';
  }

  function townName(baseTown: string): string {
    const f = store.baseGeo(baseYear()).towns.features.find((x) => x.properties.TOWNCODE === baseTown);
    return f ? stripBrackets(f.properties.TOWNNAME) : '';
  }

  function villageName(id: string, baseTown: string): string {
    if (id.startsWith('n:')) return id.slice(2);
    for (const y of [...store.meta.resultYears()].reverse()) {
      const r = store.villageRow(y, id, baseTown);
      if (r) return r.name;
    }
    const [y, code] = id.includes(':') ? [Number(id.split(':')[0]), id.split(':')[1]] : [baseYear(), id];
    const f = store.villagesOfTown(y, baseTown).features.find((x) => x.properties.VILLCODE === code);
    return f ? stripBrackets(f.properties.VILLNAME) : '';
  }

  return { prevYear, validateCtx, rowAt, flipAt, countyName, townName, villageName };
}

/** 某列的章魚狀態（縣市當選人用同一場選舉查） */
export function bwOf(store: ElectionStore, year: number, level: Level, row: ResultRow | undefined): BwStatus {
  if (!row || !store.meta.hasResults(year)) return { kind: 'na' };
  return bwStatus(row, level, store.countyWinner(year, row.contest));
}

/** 本屆代碼的區塊和前一屆比是否輪替；沒有前屆可比為 null */
function flipOf(store: ElectionStore, year: number, level: Level, row: ResultRow, yearCode: string): boolean | null {
  if (level === 'county') return row.flipped ?? null;
  const p = prevResultYear(store, year);
  if (p === null) return null;
  if (level === 'town') return flipBetween(row, store.townRow(p, toBaseArea(yearCode)), store.meta);
  const town = toBaseArea(townOfVillage(yearCode));
  return flipBetween(row, store.villageRow(p, store.villageIdOf(year, yearCode), town), store.meta);
}

/** 單一區塊（本屆代碼）的填色；未開票的屆次一律 NONE */
export function fillOf(store: ElectionStore, year: number, layer: Layer, level: Level, yearCode: string): string {
  if (!store.meta.hasResults(year)) return NONE;
  const row = store.rowByCode(year, level, yearCode);
  if (!row) return NONE;
  const flipped = layer === 'flip' ? flipOf(store, year, level, row, yearCode) : null;
  const bw = layer === 'bellwether' ? bwOf(store, year, level, row) : undefined;
  return fillFor(layer, row, store.meta, flipped, bw);
}

const levelOfSource = (hit: PaneHit): Level =>
  (hit.source === 'counties' ? 'county' : hit.source === 'towns' ? 'town' : 'village');

function bwLine(st: BwStatus): string | null {
  switch (st.kind) {
    case 'ok': return `偏差 ${pp2(st.dev)}`;
    case 'notWinner': return '第一名與全縣市不同';
    case 'lowValid': return `有效票不足 ${BW_MIN_VALID}`;
    case 'na': return null;
  }
}

export function tooltipLines(store: ElectionStore, year: number, hit: PaneHit, layer: Layer): string[] {
  const level = levelOfSource(hit);
  const row = store.rowByCode(year, level, hit.code);
  const props = hit.props;
  const name = row?.name ?? stripBrackets(props.VILLNAME || props.TOWNNAME || props.COUNTYNAME);
  const title = level === 'county' ? name : `${props.COUNTYNAME} · ${name}`;
  const lines = [title];
  if (!store.meta.hasResults(year)) {
    const n = store.meta.contest(year, props.COUNTYNAME)?.candidates.length ?? 0;
    lines.push(`${year} · ${n} 位參選人 · 尚未開票`);
  } else if (!row) {
    lines.push('本屆無資料');
  } else {
    const [, , pct] = row.votes[0];
    lines.push(`${year} · ${store.meta.candidate(row.winner).name}（${store.meta.partyOfCandidate(row.winner).label}）${pct2(pct)}`);
    const bw = layer === 'bellwether' ? bwLine(bwOf(store, year, level, row)) : null;
    if (bw) lines.push(bw);
    else if (layer === 'turnout') lines.push(`投票率 ${pct2(row.turnout)}`);
    else lines.push(`差距 ${pp2(row.margin_pp)} · ${int(row.margin_votes)} 票`);
    if (layer === 'flip') {
      const f = flipOf(store, year, level, row, hit.code);
      lines.push(f === null ? '無前屆比較' : f ? '政黨輪替' : '延續執政');
    }
  }
  if (props.BORROWED) lines.push(BORROWED_NOTE);
  return lines;
}
