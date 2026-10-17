import type { ResultRow } from '../data/types';
import type { MetaIndex } from '../data/meta';

export const OTHER_COLOR = '#8A90A6';

/** 得票堆疊條：前三名＋得票率 ≥5% 者各一段，其餘併為「其他」。 */
export function stackSegments(row: ResultRow, meta: MetaIndex): { color: string; label: string; pct: number }[] {
  const segs: { color: string; label: string; pct: number }[] = [];
  let other = 0;
  row.votes.forEach(([id, , pct], i) => {
    if (i < 3 || pct >= 5) segs.push({ color: meta.partyOfCandidate(id).color, label: meta.candidate(id).name, pct });
    else other += pct;
  });
  if (other > 0) segs.push({ color: OTHER_COLOR, label: '其他', pct: Math.round(other * 100) / 100 });
  return segs;
}
