import type { Candidate, Contest, Meta, Party } from './types';

/** meta.json 的查詢：候選人、政黨、每屆每縣市的選舉。 */
export class MetaIndex {
  private parties = new Map<number, Party>();
  private candidates = new Map<number, Candidate>();
  private contests = new Map<string, Contest>();

  constructor(readonly meta: Meta) {
    for (const p of meta.parties) this.parties.set(p.id, p);
    for (const c of meta.contests) {
      this.contests.set(`${c.year}|${c.county}`, c);
      for (const cand of c.candidates) this.candidates.set(cand.id, cand);
    }
  }

  years(): number[] {
    return this.meta.elections.map((e) => e.year);
  }

  resultYears(): number[] {
    return this.meta.elections.filter((e) => e.has_results).map((e) => e.year);
  }

  /** 跨屆對應的基準屆次（最後一屆，目前是 2026） */
  baseYear(): number {
    return this.years()[this.years().length - 1];
  }

  hasResults(year: number): boolean {
    return this.meta.elections.some((e) => e.year === year && e.has_results);
  }

  party(id: number): Party {
    const p = this.parties.get(id);
    if (!p) throw new Error(`meta.json 沒有政黨 ${id}`);
    return p;
  }

  candidate(id: number): Candidate {
    const c = this.candidates.get(id);
    if (!c) throw new Error(`meta.json 沒有候選人 ${id}`);
    return c;
  }

  partyOfCandidate(id: number): Party {
    return this.party(this.candidate(id).party);
  }

  contest(year: number, county: string): Contest | undefined {
    return this.contests.get(`${year}|${county}`);
  }
}
