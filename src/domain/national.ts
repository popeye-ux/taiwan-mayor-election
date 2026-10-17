import type { Party, ResultRow } from '../data/types';
import type { MetaIndex } from '../data/meta';

/** 各政黨席次（縣市層第一名），席次多到少，同席次依政黨 id */
export function seatsByParty(rows: ResultRow[], meta: MetaIndex): { party: Party; seats: number }[] {
  const m = new Map<number, { party: Party; seats: number }>();
  for (const r of rows) {
    const p = meta.partyOfCandidate(r.winner);
    const e = m.get(p.id) ?? m.set(p.id, { party: p, seats: 0 }).get(p.id)!;
    e.seats++;
  }
  return [...m.values()].sort((a, b) => b.seats - a.seats || a.party.id - b.party.id);
}

/** 全國投票率 = Σ(選舉人 × 投票率) / Σ選舉人 */
export function weightedTurnout(rows: ResultRow[]): number {
  const electors = rows.reduce((s, r) => s + r.electors, 0);
  return electors ? rows.reduce((s, r) => s + r.electors * r.turnout, 0) / electors : 0;
}

export function flipCount(rows: ResultRow[]): number {
  return rows.filter((r) => r.flipped === true).length;
}
