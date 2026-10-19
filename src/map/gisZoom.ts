// GIS 縮放分級與視角參數（design.md 第六節）。獨立成檔，測試不必載入 maplibre-gl。

export type ZoomLevel = 'county' | 'town' | 'village';

export const ZOOM_TOWN = 8.5;
export const ZOOM_VILLAGE = 12;
export const MIN_ZOOM = 5.5;
export const MAX_ZOOM = 16;
export const INITIAL = { center: [120.9, 23.7] as [number, number], zoom: 6.9 };

export type FitPadding = { top: number; right: number; bottom: number; left: number };

const PADDING: FitPadding = { top: 90, bottom: 60, left: 60, right: 500 };

/** 點選或從側欄選取後的 fitBounds 參數 */
export const FIT: Record<ZoomLevel, { padding: FitPadding; duration: number; minZoom?: number; maxZoom: number }> = {
  county: { padding: PADDING, duration: 900, maxZoom: 10.5 },
  town: { padding: PADDING, duration: 900, minZoom: 12.2, maxZoom: 13.5 },
  village: { padding: PADDING, duration: 700, maxZoom: 15 },
};

export function levelAtZoom(z: number): ZoomLevel {
  return z < ZOOM_TOWN ? 'county' : z < ZOOM_VILLAGE ? 'town' : 'village';
}
