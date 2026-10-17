import type { ResultRow } from '../data/types';
import type { MetaIndex } from '../data/meta';

/** 第一名政黨（short）與前一屆不同為 true、相同為 false；任一屆沒有資料為 null。 */
export function flipBetween(cur: ResultRow | undefined, prev: ResultRow | undefined, meta: MetaIndex): boolean | null {
  if (!cur || !prev) return null;
  return meta.partyOfCandidate(cur.winner).short !== meta.partyOfCandidate(prev.winner).short;
}
