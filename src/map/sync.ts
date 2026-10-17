import type maplibregl from 'maplibre-gl';

export interface CameraLike {
  getCenter(): { lng: number; lat: number };
  getZoom(): number;
  jumpTo(o: { center: [number, number]; zoom: number }): void;
  on(type: 'move', fn: (e: { originalEvent?: unknown }) => void): void;
  off(type: 'move', fn: (e: { originalEvent?: unknown }) => void): void;
  /** 使用者操作進行中（例如滾輪縮放的後段動畫，這時的 move 不帶 originalEvent） */
  userActive?(): boolean;
}

/** MapLibre 地圖 → CameraLike，滾輪或拖曳進行中視為使用者操作 */
export function cameraOf(m: maplibregl.Map): CameraLike {
  return {
    getCenter: () => m.getCenter(),
    getZoom: () => m.getZoom(),
    jumpTo: (o) => { m.jumpTo(o); },
    on: (t, fn) => { m.on(t, fn); },
    off: (t, fn) => { m.off(t, fn); },
    userActive: () => m.scrollZoom.isActive() || m.dragPan.isActive(),
  };
}

/** 使用者操作任一張圖（事件帶 originalEvent，或 userActive）時，其餘的圖跳到同樣的中心與縮放。回傳解除函式。 */
export function syncCameras(maps: CameraLike[]): () => void {
  let forwarding = false;
  const handlers = maps.map((src) => {
    const fn = (e: { originalEvent?: unknown }) => {
      if (forwarding || !(e.originalEvent || src.userActive?.())) return;
      forwarding = true;
      const c = src.getCenter();
      const view = { center: [c.lng, c.lat] as [number, number], zoom: src.getZoom() };
      for (const m of maps) if (m !== src) m.jumpTo(view);
      forwarding = false;
    };
    src.on('move', fn);
    return fn;
  });
  return () => maps.forEach((m, i) => m.off('move', handlers[i]));
}

const easeCubicOut = (t: number) => 1 - (1 - t) ** 3;

/** 以最後一張圖算出視角，四張圖用相同參數移動（600ms）。地圖還沒準備好時回傳 false。 */
export function easeAllTo(
  maps: maplibregl.Map[],
  bounds: [[number, number], [number, number]],
  padding: { top: number; right: number; bottom: number; left: number },
  instant: boolean,
): boolean {
  const ref = maps[maps.length - 1];
  if (!ref) return false;
  const cam = ref.cameraForBounds(bounds, { padding });
  if (!cam) return false;
  for (const m of maps) {
    m.stop();
    m.easeTo({ center: cam.center, zoom: cam.zoom, duration: instant ? 0 : 600, easing: easeCubicOut });
  }
  return true;
}

/** +／− 按鈕：每次 1.6 倍、280ms */
export function zoomAll(maps: maplibregl.Map[], dir: 1 | -1): void {
  const z = maps[0]?.getZoom();
  if (z === undefined) return;
  for (const m of maps) m.zoomTo(z + dir * Math.log2(1.6), { duration: 280 });
}
