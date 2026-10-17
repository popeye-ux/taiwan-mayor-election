// 狀態改變後的載入與重繪流程（從 useCompare 抽出，方便測試）
import { STALE } from '../data/cache';
import type { ViewState } from '../state/url';

export type LoadStatus =
  | { kind: 'idle' }
  | { kind: 'loading'; what: 'villages' }
  | { kind: 'error'; what: 'towns' | 'villages' };

export interface ApplyDeps {
  state(): ViewState;
  /** 回傳修正後的狀態；withVillages 為 false 時不檢查 village */
  validate(s: ViewState, withVillages: boolean): ViewState;
  replace(s: ViewState): void;
  hasVillages(): boolean;
  ensureTowns(): Promise<void>;
  /** 已用 latest() 包住：較早的請求回傳 STALE */
  ensureVillages(): Promise<void | typeof STALE>;
  paint(): void;
  /** 目標範圍改變時才移動視角 */
  frame(): void;
  setLoad(l: LoadStatus): void;
  /** 有新資料載入，通知畫面重算 */
  bump(): void;
}

const same = (a: ViewState, b: ViewState) => JSON.stringify(a) === JSON.stringify(b);

export async function runApply(d: ApplyDeps): Promise<void> {
  const s = d.state();
  const fixed = d.validate(s, d.hasVillages());
  if (!same(fixed, s)) {
    d.replace(fixed);
    return;
  }
  if (!s.county) d.setLoad({ kind: 'idle' });
  if (s.county) {
    try {
      await d.ensureTowns();
    } catch {
      d.setLoad({ kind: 'error', what: 'towns' });
      return;
    }
    d.setLoad({ kind: 'idle' });
    d.bump();
  }
  if (s.town && !d.hasVillages()) {
    d.setLoad({ kind: 'loading', what: 'villages' });
    // 先縮放到鄉鎮（只需要開站時已載入的圖資），村里載完再疊上
    d.paint();
    d.frame();
    let r: void | typeof STALE;
    try {
      r = await d.ensureVillages();
    } catch {
      if (d.state().town) d.setLoad({ kind: 'error', what: 'villages' });
      return;
    }
    if (r === STALE) return;
    d.setLoad({ kind: 'idle' });
    d.bump();
    const cur = d.state();
    const again = d.validate(cur, true);
    if (!same(again, cur)) {
      d.replace(again);
      return;
    }
  }
  d.paint();
  d.frame();
}
