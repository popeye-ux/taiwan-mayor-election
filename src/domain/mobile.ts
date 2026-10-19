// 手機版手勢判定：抽屜三段吸附、選取變深時升抽屜、摘要列左右滑動換屆。純函式，不依賴 Vue／MapLibre。
import type { ViewState } from '../state/url';

export type DrawerSnap = 'collapsed' | 'half' | 'full';

const ORDER: DrawerSnap[] = ['collapsed', 'half', 'full'];
/** 收合時露出把手＋眉標＋標題 */
export const DRAWER_COLLAPSED = 120;
/** 放開時速度（px/ms）超過這個值，就往該方向跳下一段 */
const FLING = 0.5;

/** 三段高度；全開到頂部控制列下緣（topH）再留 8px */
export function snapHeights(viewportH: number, topH: number): Record<DrawerSnap, number> {
  return { collapsed: DRAWER_COLLAPSED, half: Math.round(viewportH * 0.45), full: viewportH - topH - 8 };
}

/** 放開抽屜時要吸附的段；velocity 正值＝抽屜變高 */
export function snapTo(height: number, velocity: number, heights: Record<DrawerSnap, number>): DrawerSnap {
  if (Math.abs(velocity) >= FLING) {
    if (velocity > 0) return ORDER.find((s) => heights[s] > height) ?? 'full';
    return [...ORDER].reverse().find((s) => heights[s] < height) ?? 'collapsed';
  }
  return ORDER.reduce((best, s) => (Math.abs(heights[s] - height) < Math.abs(heights[best] - height) ? s : best));
}

/** 點把手：收合 → 半開 → 全開 → 收合 */
export function nextSnap(s: DrawerSnap): DrawerSnap {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

/** 點地圖選取後：收合的抽屜升到半開，其他不動 */
export function afterPick(s: DrawerSnap): DrawerSnap {
  return s === 'collapsed' ? 'half' : s;
}

const depth = (s: ViewState) => (s.village ? 3 : s.town ? 2 : s.county ? 1 : 0);
const selKey = (s: ViewState) => `${s.county}|${s.town}|${s.village}`;

/** 選了新的區域（同層換一個或往下鑽）；回上層、取消選取、換年份圖層都不算 */
export function selectionDeepened(prev: ViewState, next: ViewState): boolean {
  return depth(next) > 0 && selKey(next) !== selKey(prev) && depth(next) >= depth(prev);
}

/** 摘要列水平位移換成換屆方向：往左滑＝下一屆 */
export function swipeStep(dx: number, threshold = 40): -1 | 0 | 1 {
  if (dx <= -threshold) return 1;
  if (dx >= threshold) return -1;
  return 0;
}

/** 前後一屆，到頭不循環 */
export function stepYear(years: number[], current: number, step: -1 | 0 | 1): number {
  const i = years.indexOf(current);
  if (i < 0) return current;
  return years[Math.min(years.length - 1, Math.max(0, i + step))];
}
