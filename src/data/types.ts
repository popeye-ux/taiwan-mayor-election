// data/json/ 與 data/geo/ 的型別；欄位定義見 docs/superpowers/specs/2026-10-14-static-json-design.md

export type Level = 'county' | 'town' | 'village';
export type Layer = 'party' | 'margin' | 'turnout' | 'flip' | 'bellwether';

export interface Election { year: number; vote_date: string; has_results: boolean }
export interface Party { id: number; name: string; label: string; short: string; color: string }
export interface Candidate {
  id: number; ballot_no: number | null; name: string; party: number;
  gender: string | null; age: number | null; incumbent: boolean | null; elected: boolean | null;
}
export interface Contest {
  id: number; year: number; county: string; vote_date: string; note: string | null; candidates: Candidate[];
}
export interface Meta { elections: Election[]; parties: Party[]; contests: Contest[] }

/** [候選人 id, 票數, 得票率]，依票數由高到低 */
export type Vote = [candidate: number, votes: number, pct: number];

export interface ResultRow {
  id: number; contest: number; name: string; county: string; town: string | null;
  group: boolean; moi: string[]; electors: number; valid: number; turnout: number; votes: Vote[];
  winner: number; margin_votes: number; margin_pp: number;
  /** 只有縣市層有 */
  flipped?: boolean | null;
  /** 章魚偏差（pp），只有鄉鎮、村里層有；票數為 0 時為 null */
  bw_dev?: number | null;
}

export interface CountyProps { COUNTYCODE: string; COUNTYNAME: string }
export interface TownProps extends CountyProps { TOWNCODE: string; TOWNNAME: string }
export interface VillProps extends TownProps {
  VILLCODE: string; VILLNAME: string;
  /** 形狀借用自哪一屆的圖資（目前只有 2014 的部分村里，值為 "2018"） */
  BORROWED?: string;
}
