import { format } from 'd3-format';

const comma = format(',');

/** 得票率、投票率（側欄、tooltip）：42.29% */
export const pct2 = (v: number) => `${v.toFixed(2)}%`;
/** 摘要列、清單：42.3% */
export const pct1 = (v: number) => `${v.toFixed(1)}%`;
/** 差距：20.40 pp */
export const pp2 = (v: number) => `${v.toFixed(2)} pp`;
/** 摘要列的差距：+20.4 pp */
export const ppSigned1 = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)} pp`;
/** 票數、選舉人數：575,590 */
export const int = (v: number) => comma(v);
