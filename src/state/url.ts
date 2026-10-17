// 檢視狀態 ↔ URL query。縣市、鄉鎮、村里一律用 2026 基準代碼（村里另有 `{year}:` 與 `n:` 兩種識別）。
import type { Layer } from '../data/types';

export interface ViewState {
  /** 只有 GIS 讀；null 表示預設屆次（不寫進網址） */
  year: number | null;
  layer: Layer;
  county: string | null;
  town: string | null;
  village: string | null;
}

export const DEFAULT_STATE: ViewState = { year: null, layer: 'party', county: null, town: null, village: null };
const LAYERS: Layer[] = ['party', 'margin', 'turnout', 'flip', 'bellwether'];

const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

export function parseQuery(q: Record<string, unknown>): ViewState {
  const layer = str(q.layer);
  const year = str(q.year);
  return {
    year: year && /^\d{4}$/.test(year) ? Number(year) : null,
    layer: LAYERS.includes(layer as Layer) ? (layer as Layer) : 'party',
    county: str(q.county),
    town: str(q.town),
    village: str(q.village),
  };
}

export function toQuery(s: ViewState): Record<string, string> {
  const q: Record<string, string> = {};
  if (s.year !== null) q.year = String(s.year);
  if (s.layer !== DEFAULT_STATE.layer) q.layer = s.layer;
  if (s.county) q.county = s.county;
  if (s.town) q.town = s.town;
  if (s.village) q.village = s.village;
  return q;
}

export interface ValidateCtx {
  /** 不提供時 year 原樣保留 */
  hasYear?: (year: number) => boolean;
  hasCounty(county: string): boolean;
  townInCounty(town: string, county: string): boolean;
  /** 村里圖資尚未載入時不提供，village 原樣保留 */
  villageValid?: (id: string, town: string) => boolean;
}

/** 從上層往下檢查，遇到不存在或不屬於上層的代碼，從該層起全部丟棄。 */
export function validate(s: ViewState, ctx: ValidateCtx): ViewState {
  const out = { ...s };
  if (out.year !== null && ctx.hasYear && !ctx.hasYear(out.year)) out.year = null;
  if (out.county && !ctx.hasCounty(out.county)) out.county = null;
  if (!out.county || (out.town && !ctx.townInCounty(out.town, out.county))) out.town = null;
  if (!out.town || (out.village && ctx.villageValid && !ctx.villageValid(out.village, out.town))) out.village = null;
  return out;
}

/** 退一層（Esc） */
export function up(s: ViewState): ViewState {
  if (s.village) return { ...s, village: null };
  if (s.town) return { ...s, town: null };
  if (s.county) return { ...s, county: null };
  return s;
}
